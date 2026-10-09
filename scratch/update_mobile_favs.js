import fs from 'fs';

const filePath = 'frontend/src/App.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const target = `                {favoriteSections.length > 0 && (
                  <optgroup label="⭐ Favorites">
                    {favoriteSections.flatMap(secName => {
                      const grp = TOOL_GROUPS.find(g => g.name === secName);
                      return grp ? grp.items.map(i => (
                        <option key={\`fav-mob-\${i.id}\`} value={i.id}>{grp.name}: {i.label}</option>
                      )) : [];
                    })}
                  </optgroup>
                )}`;

const replacement = `                {favoriteTabs.length > 0 && (
                  <optgroup label="⭐ Favorites">
                    {favoriteTabs.map(tabId => {
                      const item = ALL_TABS_MAP.get(tabId);
                      return item ? (
                        <option key={\`fav-mob-\${item.id}\`} value={item.id}>⭐ {item.label}</option>
                      ) : null;
                    })}
                  </optgroup>
                )}`;

if (!content.includes(target)) {
  console.error('Target not found in App.tsx');
  process.exit(1);
}

content = content.replace(target, replacement);
fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully replaced mobile favorites optgroup!');
