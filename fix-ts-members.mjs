import fs from 'fs';
const path = 'src/pages/Members.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  'const match = inv.discount_description.match(/(?:joint|join)\\s*(?:with)?\\s*[:#-]?\\s*([\\d,\\s&]+)/i);',
  'const match = inv.discount_description?.match(/(?:joint|join)\\s*(?:with)?\\s*[:#-]?\\s*([\\d,\\s&]+)/i);'
);

fs.writeFileSync(path, content, 'utf8');
