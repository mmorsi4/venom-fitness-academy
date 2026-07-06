import fs from 'fs';
const path = 'src/lib/utils.ts';
let content = fs.readFileSync(path, 'utf8');

const targetStr = `    ptCheckIns: ptCheckIns.length,
    subCheckIns: groupCheckInsAsSub.length
  };
}`;

const replacementStr = `    ptCheckIns: ptCheckIns.length,
    subCheckIns: groupCheckInsAsSub.length,
    unpaidCheckInIds: [...unpaidGroupMain, ...unpaidGroupSub, ...unpaidPtCheckIns].map(ci => ci.id)
  };
}`;

if (content.includes(targetStr)) {
  content = content.replace(targetStr, replacementStr);
  fs.writeFileSync(path, content, 'utf8');
} else {
  console.log("Could not find target block");
}
