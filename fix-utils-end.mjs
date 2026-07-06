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

// I need to be careful because the previous replace messed up lines 105-117.
// Let's restore from git first.
