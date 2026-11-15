"""Split W2.docx in document order, preserving source wording and code tables."""
from pathlib import Path
from docx import Document
from docx.oxml.ns import qn
from docx.text.paragraph import Paragraph
from docx.table import Table

root = Path(__file__).resolve().parent.parent
document = Document(root / 'course/W2/W2.docx')
sections = [[], [], [], []]
active = None
for element in document.element.body:
    if element.tag == qn('w:p'):
        paragraph = Paragraph(element, document)
        text = paragraph.text.strip()
        if not text:
            continue
        for index, prefix in enumerate(['1. 类、对象、方法', '2. 构造方法', '3. 关键字this & new', '4.流程控制基础']):
            if text.startswith(prefix):
                active = index
                text = '# ' + text.replace('\n', '\n\n', 1)
                break
        else:
            if paragraph.style.name == 'List Paragraph':
                text = '- ' + text
            elif text == '预告与布置:':
                text = '## ' + text
        if active is not None:
            sections[active].append(text)
    elif element.tag == qn('w:tbl') and active is not None:
        table = Table(element, document)
        for row in table.rows:
            for cell in row.cells:
                text = cell.text.strip()
                if not text:
                    continue
                sections[active].append('```java\n' + text + '\n```' if '{' in text or text.startswith('Arm a1') else text)

destination = root / 'course/W2/lessons'
destination.mkdir(exist_ok=True)
for i, blocks in enumerate(sections, 1):
    if not blocks:
        raise ValueError(f'Missing W2.{i}')
    (destination / f'W2.{i}.md').write_text('\n\n'.join(blocks) + '\n')
print('Extracted four W2 lessons without rewriting source wording.')
