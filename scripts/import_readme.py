#!/usr/bin/env python3
"""Import the curated English catalog without changing the source repository."""
import argparse
import hashlib
import html
import json
import re
import subprocess
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOMAINS = ['Speech', 'Music', 'Audio']

def text(value):
    value = re.sub(r'<br\s*/?>', '\n', value)
    value = re.sub(r'<img\b[^>]*>', '', value)
    value = re.sub(r'<[^>]+>', '', value)
    value = re.sub(r'\[([^\]]+)\]\(([^\s]+)\)', r'\1', value)
    return html.unescape(value).replace('**', '').replace('`', '').strip()

def links(value, kind):
    result = []
    for match in re.finditer(r'<a\s+href="([^"]+)"[^>]*>(.*?)</a>|\[([^\]]+)\]\(([^\s]+)\)', value):
        url, body, label, md_url = match.groups()
        if url:
            alt = re.search(r'alt="([^"]+)"', body)
            label = alt.group(1) if alt else text(body)
        else:
            url = md_url
        label = re.sub(r'^[^A-Za-z0-9]+', '', html.unescape(label or kind))
        item = {'kind': kind, 'label': label, 'url': html.unescape(url)}
        note = re.match(r'\s*\(([^)]*)\)', value[match.end():])
        if note: item['note'] = text(note[1])
        result.append(item)
    return result

def slug(value):
    return re.sub(r'[^a-z0-9]+', '-', value.lower()).strip('-')

def domains(value):
    return [d for d in DOMAINS if re.search(r'\b' + d + r'\b', value)]

def categories(value):
    # Only the leading list is authoritative (not explanatory prose after it).
    value = value.split('; editing')[0].split(' (')[0]
    return [c for c in ['Acoustic', 'Semantic', 'Instance', 'Composite'] if c in value]

def architectures(value):
    tags = []
    if re.search(r'LM|language', value): tags.append('Language model')
    if 'Codec LM' in value or 'codec LM' in value: tags.append('Codec language model')
    if re.search(r'diffusion|Diffusion|Score-based', value): tags.append('Diffusion')
    if re.search(r'flow|Flow', value): tags.append('Flow matching')
    return tags

def sections(source):
    stack, tables = {}, []
    lines = source.splitlines()
    for i, line in enumerate(lines):
        heading = re.match(r'^(#{1,6}) (.+)', line)
        if heading:
            depth, title = len(heading[1]), heading[2]
            stack = {k:v for k,v in stack.items() if k < depth}
            stack[depth] = title
        if line.startswith('|') and i + 1 < len(lines) and re.fullmatch(r'[| :\-]+', lines[i+1]):
            headers = [c.strip() for c in line.strip('|').split('|')]
            rows, j = [], i+2
            while j < len(lines) and lines[j].startswith('|'):
                cells = [c.strip() for c in lines[j].strip('|').split('|')]
                if len(cells) != len(headers): raise ValueError(f'Malformed table line {j+1}')
                rows.append(cells); j += 1
            tables.append((dict(stack), headers, rows))
    return tables

def build(source, revision):
    data = {'meta': {'source': 'https://github.com/MM-Speech/AudioEditSurvey', 'revision': revision,
                     'readmeSha256': hashlib.sha256(source.encode()).hexdigest(), 'updated': date.today().isoformat()},
            'models': [], 'datasets': [], 'tools': [], 'benchmarks': [], 'metrics': []}
    training_free = {}
    for headings, headers, rows in sections(source):
        title = list(headings.values())[-1]
        if 'Conference / Journal' in headers:
            for row in rows: training_free[text(row[0])] = text(row[1])
        elif title.endswith(' Models'):
            for row in rows:
                unified = title == 'Unified Models'
                name = text(row[0]); offset = 1 if unified else 0
                ds = domains(text(row[1])) if unified else [title.split()[0]]
                ops, arch = text(row[1+offset]), text(row[2+offset])
                data['models'].append({'id': slug(name), 'name': name, 'domains': ds,
                    'group': 'Unified' if unified else ds[0], 'editing': ops, 'categories': categories(ops),
                    'architecture': arch, 'architectures': architectures(arch),
                    'links': links(row[3+offset], 'Paper') + links(row[4+offset], 'Code') + links(row[5+offset], 'Model')})
        elif headers[0] == 'Name' and 'Duration' in headers:
            for row in rows:
                name = text(row[0]); annotation = text(row[6]); duration = text(row[3])
                group = title
                tags = [label for label, pattern in [('Instruction',r'Instruct'),('Caption',r'[Cc]aption'),('Transcript',r'[Tt]ranscript|lyrics|phoneme'),('Label',r'Label|labels'),('MIDI / score',r'MIDI|score')] if re.search(pattern, annotation)]
                data['datasets'].append({'id': slug(name), 'name': name, 'group': group,
                    'domains': DOMAINS if group == 'Unified' else [group], 'duration': duration,
                    'hours': float(re.search(r'[\d,]+(?:\.\d+)?', duration)[0].replace(',','')),
                    'paired': '✅' in row[4], 'pairing': text(row[4]).replace('✅','').replace('❌','').strip(),
                    'editing': text(row[5]), 'categories': categories(text(row[5])),
                    'annotation': annotation, 'annotationTypes': tags, 'modalities': text(row[7]),
                    'links': links(row[1], 'Paper') + links(row[2], 'Dataset')})
        elif headers[0] == 'Tool':
            purpose = 'Generation' if 'Generation' in headings[4] else 'Annotation'
            for row in rows:
                name = text(row[0]); group = title
                model_notes = re.sub(r'<a\b.*?</a>', '', row[5])
                data['tools'].append({'id': slug(name)+'-'+purpose.lower(), 'name': name, 'group': group,
                    'domains': DOMAINS if group == 'Unified' else [group], 'purpose': purpose,
                    'categories': categories(text(row[1])), 'editing': text(row[1]),
                    'description': text(row[2]), 'level': text(row[3]), 'access': text(model_notes),
                    'links': links(row[4], 'Code') + links(row[5], 'Model')})
        elif headers[0] in ('Metric', 'Evaluator'):
            for row in rows:
                name = text(row[0]); evaluator = headers[0] == 'Evaluator'
                domain_text, description = (text(row[1]), text(row[2])) if evaluator else (text(row[2]), text(row[1]))
                ds = domains(domain_text)
                data['metrics'].append({'id': slug(name), 'name': name, 'group': 'Unified' if len(ds)>1 else ds[0],
                    'domains': ds, 'domainNote': domain_text, 'dimension': title,
                    'description': description, 'inputs': text(row[3]),
                    'links': links(row[4], 'Paper') + links(row[5], 'Code / Model')})
    for model in data['models']:
        model['paradigm'] = 'Training-free' if model['name'] in training_free else 'Training-based'
        if model['name'] in training_free: model['venue'] = training_free[model['name']]
    benchmark_block = source.split('### 🧪 Benchmarks')[1].split('### 📏 Evaluation Metrics')[0]
    for chunk in re.split(r'^#### ', benchmark_block, flags=re.M)[1:]:
        heading, body = chunk.split('\n',1)
        fields = {}
        for line in body.splitlines():
            match = re.match(r'- \*\*([^*]+):\*\*\s*(.*)', line)
            if match: fields[match[1]] = match[2]
        if 'TL;DR' not in fields: continue
        ds = domains(text(fields['Audio modalities']))
        heading_match = re.fullmatch(r'(.*?) \((.*?)\)', heading)
        name, venue = heading_match.groups() if heading_match else (heading, None)
        urls = []
        for segment in re.split(r'; \*\*', fields['Paper']):
            kind, value = ('Paper',segment) if ':**' not in segment else segment.split(':**',1)
            urls += links(value, kind)
        results = []
        for label, content in re.findall(r'^  - \*\*([^*]+):\*\* (.*)',body,re.M):
            results.append({'label':label,'text':text(content),'links':links(content,'Source')})
        category_text = text(fields['Editing categories'])
        data['benchmarks'].append({'id': slug(name), 'name': name, 'venue': venue,
            'group': 'Unified' if len(ds)>1 else ds[0], 'domains':ds,
            'description': text(fields['TL;DR']), 'domainNote':text(fields['Audio modalities']),
            'editing': category_text, 'categories':categories(category_text),
            'evaluation':text(fields['Evaluation method']), 'results':results, 'links':urls})
    data['citation'] = re.search(r'```bibtex\n(.*?)```',source,re.S)[1].strip()
    for key in ('models','datasets','tools','benchmarks','metrics'):
        assert len({r['id'] for r in data[key]}) == len(data[key]), f'Duplicate IDs in {key}'
        assert data[key], f'Empty {key}'
    assert len(data['models']) == 27 and len(data['datasets']) == 30
    assert len(training_free) == 6
    return data

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('readme',type=Path)
    parser.add_argument('--output', type=Path, default=ROOT/'data/resources.json')
    args = parser.parse_args()
    source = args.readme.read_text()
    revision = subprocess.check_output(['git','-C',str(args.readme.parent),'rev-parse','HEAD'],text=True).strip()
    data = build(source,revision)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
    print(', '.join(f'{len(data[k])} {k}' for k in ('models','datasets','tools','benchmarks','metrics')))

if __name__ == '__main__': main()
