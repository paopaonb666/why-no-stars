// Pillar 6: Momentum — is anything arriving, or is it perfectly still?
// Star recency uses three honest data sources, in order of quality:
//   full     — every star timestamp known (repos with <= 100 stars)
//   lastpage — the newest 100 stars (deep stargazers pagination worked)
//   events   — WatchEvents from the public events feed (huge repos where
//              GitHub caps stargazers pagination; a lower bound, not a count)
import { check } from './helpers.js';

const DAY = 86400000;

export function momentumChecks(f) {
  const out = [];
  const now = f.now;
  const ts = f.stargazerTimestamps ?? [];
  const eventsPresent = f.eventsPresent === true;

  const recent28FromSample = ts.filter((t) => now - new Date(t) <= 28 * DAY).length;

  const sampleNotes = {
    full: { en: `all ${f.stars} star timestamps known`, zh: `已知全部 ${f.stars} 个 star 的时间戳` },
    lastpage: { en: `sampled the most recent ${ts.length} stars`, zh: `采样了最近 ${ts.length} 个 star` },
    none: null,
  };

  out.push(
    check('recent-stars', 'momentum', { en: 'Stars in the last 28 days', zh: '最近 28 天有新增 star' }, {
      status: momentumStatus(f, ts, recent28FromSample, eventsPresent),
      detail: momentumDetail(f, ts, recent28FromSample, eventsPresent, sampleNotes),
      fix: {
        en: 'Every push/announcement should ride a channel: Show HN, r/SideProject, dev communities, or a “what changed” post. Star velocity follows exposure.',
        zh: '每次更新都要配一个曝光渠道：Show HN、V2EX、掘金、即刻、开发者社群。star 增速跟着曝光走。',
      },
      impact: 'high',
    })
  );

  const ageWeeks = f.createdAt ? Math.max(1, (now - new Date(f.createdAt)) / (7 * DAY)) : null;
  const perWeek = ageWeeks ? f.stars / ageWeeks : null;
  out.push(
    check('star-velocity', 'momentum', { en: 'Stars per week since creation', zh: '建库以来平均每周 star' }, {
      status: perWeek === null ? 'skip' : perWeek >= 1 ? 'pass' : perWeek >= 0.2 ? 'warn' : 'fail',
      detail: perWeek !== null
        ? { en: `${perWeek.toFixed(1)} stars/week over ${Math.round(ageWeeks)} weeks.`, zh: `${Math.round(ageWeeks)} 周平均每周 ${perWeek.toFixed(1)} 颗 star。` }
        : { en: 'Creation date unknown.', zh: '创建时间未知。' },
      fix: {
        en: 'If velocity is near zero, treat the README as a landing page and re-launch the project (rename, rewrite the pitch, post again).',
        zh: '如果增速接近零，把 README 当成落地页来改，然后重新发布一次项目（改名、重写简介、再发一轮）。',
      },
      impact: 'medium',
    })
  );

  return out;
}

function momentumStatus(f, ts, recent28, eventsPresent) {
  if (f.stars === 0) return 'fail';
  if (f.starSample === 'full' || f.starSample === 'lastpage') return recent28 >= 1 ? 'pass' : 'fail';
  if (f.recentStarEvents28 >= 1) return 'pass';
  if (eventsPresent) return 'warn'; // can't confirm recency for a starred repo
  return 'skip';
}

function momentumDetail(f, ts, recent28, eventsPresent, sampleNotes) {
  if (f.stars === 0) return { en: 'This repo has 0 stars.', zh: '这个仓库还没有任何 star。' };
  if (f.starSample === 'full' || f.starSample === 'lastpage') {
    return {
      en: `${recent28} star(s) in the last 28 days (${sampleNotes[f.starSample].en}).`,
      zh: `最近 28 天新增 ${recent28} 颗 star（${sampleNotes[f.starSample].zh}）。`,
    };
  }
  if (f.recentStarEvents28 >= 1) {
    return {
      en: `Events feed shows ≥${f.recentStarEvents28} star(s) recently (lower bound; timestamps not paged).`,
      zh: `事件流显示近期至少有 ${f.recentStarEvents28} 颗新 star（下限值；未翻页统计）。`,
    };
  }
  if (eventsPresent) {
    return {
      en: 'Could not page star timestamps (GitHub caps deep pagination) and no star events appeared in the recent feed.',
      zh: '无法翻页获取 star 时间戳（GitHub 限制深分页），且最近的事件流中没有出现 star 事件。',
    };
  }
  return { en: 'Star timestamps unavailable (rate limited?).', zh: '无法获取 star 时间戳（可能被限流）。' };
}
