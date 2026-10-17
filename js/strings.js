// NEON STICK DUEL — cyber mini-SF string table [zh-HK, en]
import { i18n } from 'cyber-kit';
i18n.add({
  'doc.title': ['霓虹對打 NEON STICK DUEL · 賽博迷你格鬥', 'NEON STICK DUEL · cyber mini fighter'],
  you: ['你', 'YOU'], score: ['分數', 'SCORE'],
  pauseTip: ['暫停 (P / Esc)', 'Pause (P / Esc)'], muteTip: ['靜音 (M)', 'Mute (M)'],
  kicker: ['NEON KOWLOON · 迷你格鬥', 'NEON KOWLOON · MINI FIGHTER'],
  title: ['霓虹對打', 'NEON DUEL'], titleEn: ['NEON STICK DUEL', 'NEON STICK DUEL'],
  tagline: ['人形霓虹格鬥：劍士、魔法師、拳師、刺客。<br>Hitstop·挑空·清楚招式 —— 階梯十連戰同無盡天台塔。', 'Human neon fighter: Swordsman, Mage, Brawler, Assassin.<br>Hitstop · launch · readable attacks — ladder + endless tower.'],
  ladder: ['階梯模式', 'STAGE LADDER'], ladderS: ['第 {n}/10 戰 · {name}', 'FIGHT {n}/10 · {name}'],
  endless: ['無盡天台塔', 'ENDLESS TOWER'], endlessS: ['第 {f} 層', 'FLOOR {f}'],
  changeCls: ['職業：{c}', 'CLASS: {c}'], changeClsS: ['揀職業 · 睇招式', 'CHOOSE CLASS · MOVE LIST'],
  newRun: ['無盡塔由 1 層重新開始', 'RESTART TOWER FROM 1F'], newRunS: ['RESET TOWER', '重新開始'],
  keysHint: ['<kbd>A</kbd><kbd>D</kbd>/<kbd>←</kbd><kbd>→</kbd> 走位　<kbd>W</kbd>/<kbd>Space</kbd> 跳（空中再撳＝二段跳）　<kbd>S</kbd>/<kbd>↓</kbd> 防禦　<kbd>Shift</kbd> 閃避　<kbd>J</kbd> 攻擊　<kbd>K</kbd> <kbd>L</kbd> 技能　<kbd>U</kbd> 必殺　<kbd>P</kbd> 暫停',
    '<kbd>A</kbd><kbd>D</kbd>/<kbd>←</kbd><kbd>→</kbd> move　<kbd>W</kbd>/<kbd>Space</kbd> jump (again in the air = double jump)　<kbd>S</kbd>/<kbd>↓</kbd> guard　<kbd>Shift</kbd> dodge　<kbd>J</kbd> attack　<kbd>K</kbd> <kbd>L</kbd> skills　<kbd>U</kbd> ultimate　<kbd>P</kbd> pause'],
  touchHint: ['手機：左邊搖桿走位（上＝跳、下＝防禦）· 右邊大掣攻擊（連撳出連段），四周係防禦（加方向＝閃避）、技能 1、技能 2、跳（空中再撳＝二段跳）· 上面獨立嘅長掣係必殺', 'Touch: left stick moves (up = jump, down = guard) · big right button attacks (keep tapping to combo), ringed by guard (+ direction = dodge), skill 1, skill 2 and jump (press again in the air = double jump) · the separate long button above is the ultimate'],
  bestFloor: ['最高樓層', 'BEST FLOOR'], bestLadder: ['階梯', 'LADDER'], bestScore: ['最高分', 'BEST SCORE'], privacy: ['私隱政策', 'Privacy policy'],
  // class select
  selTitle: ['揀職業', 'CHOOSE CLASS'], selFight: ['開打', 'FIGHT'], selFightS: ['FIGHT · ENTER', '開打'], back: ['返回', 'BACK'], backS: ['BACK · ESC', '返回'],
  'st.atk': ['攻擊', 'ATK'], 'st.def': ['耐打', 'DEF'], 'st.spd': ['速度', 'SPD'], 'st.rng': ['射程', 'RANGE'],
  'role.melee': ['近戰', 'MELEE'], 'role.ranged': ['遠程', 'RANGED'], 'role.hybrid': ['近遠兼備', 'HYBRID'],
  'tag.combo': ['連段', 'COMBO'], 'tag.closer': ['突進技', 'GAP-CLOSER'], 'tag.escape': ['脫離技', 'ESCAPE'], 'tag.antiair': ['對空', 'ANTI-AIR'], 'tag.zone': ['控場', 'ZONING'], 'tag.aoe': ['範圍', 'AREA'], 'tag.ult': ['必殺', 'ULTIMATE'],
  'kit.combo': ['連撳攻擊：{list}', 'Tap attack: {list}'], 'kit.air': ['空中：{list}', 'In the air: {list}'], 'kit.cd': ['冷卻 {s} 秒', '{s}s cooldown'], 'kit.ult': ['打中／被打儲滿能量', 'charged by dealing / taking damage'],
  // HUD buttons
  'b.atk': ['攻擊', 'ATTACK'], 'dblJump': ['二段跳', 'DOUBLE JUMP'], 'b.jump': ['跳', 'JUMP'], 'b.guard': ['防禦', 'GUARD'], 'b.guardS': ['+方向＝閃避', '+dir = dodge'], 'b.ult': ['必殺', 'ULT'],
  // fight
  stageTag: ['第 {n} 戰', 'FIGHT {n}'], floorTag: ['{f}F', '{f}F'], endlessTag: ['無盡', 'ENDLESS'], bossTag: ['頭目', 'BOSS'],
  stageBanner: ['第 {n} 戰 · {name}', 'FIGHT {n} · {name}'], floorBanner: ['{f} 樓 · {name}', '{f}F · {name}'],
  fight: ['開打！', 'FIGHT!'], fightS: ['FIGHT!', '開打！'], ko: ['K.O.', 'K.O.'], down: ['倒地', 'DOWN'], knockout: ['擊倒', 'KNOCK OUT'],
  'boss.phase2': ['第二型態・崩壞', 'PHASE 2 · COLLAPSE'], 'boss.phase2S': ['PHASE 2 · COLLAPSE', '第二型態・崩壞'], 'boss.phase2N': ['機械將軍 · 數據刃解放', 'KAGE-SHŌGUN · DATA BLADES UNSEALED'],
  'boss.parry': ['鏡受け！', 'PARRIED!'], 'boss.crush': ['破鏡！', 'MIRROR BROKEN!'],
  evade: ['閃避', 'EVADE'], guardBreak: ['破防！', 'GUARD BREAK!'], armor: ['霸體', 'ARMOR'], block: ['擋', 'BLOCK'], hits: ['{n} 連擊', '{n} HITS'], counter: ['反擊', 'COUNTER'],
  ultReady: ['必殺技準備好！', 'ULTIMATE READY!'],
  milestone: ['第 {f} 層頭目', 'FLOOR {f} BOSS'], milestoneS: ['無盡里程碑 +5000', 'ENDLESS MILESTONE +5000'],
  // result
  victory: ['勝利！', 'VICTORY!'], defeat: ['戰敗', 'DEFEAT'], draw: ['平手', 'DRAW'], timeOver: ['時間到', 'TIME OVER'],
  koWin: ['K.O. 勝利', 'K.O. VICTORY'], decWin: ['判定勝利', 'DECISION'], gotKo: ['你被擊倒', 'YOU WERE KNOCKED OUT'],
  ladderClear: ['階梯十連勝！', 'LADDER CLEARED!'], ladderClearS: ['挑戰無盡天台塔啦', 'Now try the endless tower'],
  sLevel: ['過關', 'CLEAR'], sHp: ['剩血', 'HP LEFT'], sTime: ['剩餘時間', 'TIME'], sCombo: ['最高連擊', 'BEST COMBO'], sPerfect: ['完美', 'PERFECT'], sBoss: ['頭目', 'BOSS'], sTotal: ['總分', 'TOTAL'],
  sHits: ['命中', 'HITS'], sFoeHp: ['對手剩血', 'FOE HP'], sDmg: ['傷害', 'DAMAGE'],
  next: ['下一戰', 'NEXT FIGHT'], nextS: ['NEXT · ENTER', '下一戰'], nextFloor: ['上一層', 'NEXT FLOOR'], retry: ['再戰', 'RETRY'], retryS: ['RETRY · ENTER', '再戰'],
  revive: ['原地復活', 'REVIVE'], reviveAd: ['50% 血 · 睇廣告', '50% HP · WATCH AD'], reviveFree: ['50% 血 · 免費', '50% HP · FREE'], revived: ['復活！', 'REVIVED!'],
  menu: ['主畫面', 'MAIN MENU'], menuS: ['MAIN MENU', '主畫面'], loading: ['霓虹戰士上線…', 'NEON FIGHTERS ONLINE…'],
  paused: ['已暫停', 'PAUSED'], pausedS: ['PAUSED', '已暫停'], resume: ['繼續', 'RESUME'], resumeS: ['RESUME · P', 'P'], quit: ['離開', 'QUIT'], quitS: ['QUIT · MAIN MENU', 'MAIN MENU'],
  // hub / trial
  trialTag: ['試玩 · 階梯第 1–3 戰 · 無盡 1–3 層', 'TRIAL · ladder fights 1–3 · endless floors 1–3'], trialLeft: ['今日仲有 {n} 次試玩', '{n} trial runs left today'],
  trialTitle: ['試玩完結', 'TRIAL COMPLETE'], trialLadder: ['試玩只開放階梯第 1–3 戰', 'Trial: ladder fights 1–3 only'], trialEndless: ['試玩只開放無盡塔第 1–3 層', 'Trial: endless floors 1–3 only'],
  trialBody: ['試玩包括四個職業、階梯第 1–3 戰同無盡塔頭 3 層。返大廳解鎖銀級，就可以玩晒十連戰、頭目同無限無盡塔（包括日後加入銀級嘅所有新遊戲）。', 'The trial includes all four classes, ladder fights 1–3 and the first 3 endless floors. Unlock Silver in the hub to get the full 10-fight ladder, the bosses and the unlimited tower (plus every future game added to Silver).'],
  toHub: ['返大廳解鎖', 'UNLOCK IN HUB'], toHubS: ['BACK TO ARCADE', '返回大廳'], silver: ['銀級遊戲', 'SILVER GAME'],

  'help.rules': ['<ul><li>1v1 賽博迷你格鬥：連段、Hitstop、挑空、防禦、必殺。</li><li>揀職業；階梯十連戰同無盡天台塔。</li><li>讀招、抓空隙、打爆對手血條獲勝。</li></ul>', '<ul><li>1v1 cyber mini fighter: combos, hitstop, launch, guard, supers.</li><li>Pick a class; 10-fight ladder and endless tower.</li><li>Read attacks, punish gaps, empty the foe\'s bar to win.</li></ul>'],
  'help.controls': ['<ul><li>手機：左搖桿走位（上＝跳、下＝防禦）· 右大掣攻擊（連撳出連段）· 環掣：防禦／閃避、技能、跳（空中再撳＝二段跳）· 長掣＝必殺</li><li>鍵盤：<kbd>A</kbd><kbd>D</kbd>/<kbd>←</kbd><kbd>→</kbd> 走位　<kbd>W</kbd>/<kbd>Space</kbd> 跳　<kbd>S</kbd>/<kbd>↓</kbd> 防禦　<kbd>Shift</kbd> 閃避　<kbd>J</kbd> 攻擊　<kbd>K</kbd><kbd>L</kbd> 技能　<kbd>U</kbd> 必殺</li><li>暫停 <kbd>P</kbd> · 靜音 <kbd>M</kbd></li></ul>', '<ul><li>Touch: left stick moves (up = jump, down = guard) · big right button attacks (tap to combo) · ring: guard/dodge, skills, jump (air = double) · long button = ultimate</li><li>Keys: <kbd>A</kbd><kbd>D</kbd>/<kbd>←</kbd><kbd>→</kbd> move　<kbd>W</kbd>/<kbd>Space</kbd> jump　<kbd>S</kbd>/<kbd>↓</kbd> guard　<kbd>Shift</kbd> dodge　<kbd>J</kbd> attack　<kbd>K</kbd><kbd>L</kbd> skills　<kbd>U</kbd> ultimate</li><li>Pause <kbd>P</kbd> · Mute <kbd>M</kbd></li></ul>'],
});
