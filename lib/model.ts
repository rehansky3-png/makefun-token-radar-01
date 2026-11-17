// Token Radar's model, radar-2: one snapshot of the protocol universe in, one ranked board out.
//
// The board ranks every protocol the snapshot records as a genuine pre-token launch candidate:
// it records no token (no market cap, no CoinGecko id, no symbol) AND it passes the same rule the
// house used to draw the watchlist, applied to the snapshot's own fields only - not a wrapped,
// staked or bridged product of a token that already trades, not an exchange, not a versioned pool
// (see isRankable). That is 198 protocols here: the 40 on the watchlist plus 158 early ones below
// the floor. Protocols that record no token but fail that rule (WBTC, Binance staked ETH, USDT0 and
// the like) are not ranked: they are shown in the dashboard's "Set aside" table with the reason
// the rule gives, and the live-token protocols are shown apart with their market caps, never mixed
// into the ranking. No protocol name is ever special-cased: the same functions score every row.
//
// Implied value follows only from the snapshot's own figures, in four steps:
//
//   comparable = the median market-cap / TVL of the live-token protocols in the same category
//                (at least 3 of them, else the median over all live-token protocols),
//                winsorised to [0.05, 0.50] so one outlier category cannot set the price
//   base       = tvl_usd x comparable
//   growthMult = 1 + clamp(change_7d, -50, 100) / 100 x 0.6
//   maturity   = 0.70 + min(age_days, 1095) / 1095 x 0.30   (age unknown: 365 days)
//   breadth    = 1 + min(chains - 1, 4) x 0.03
//   implied    = max(1, round(base x growthMult x maturity x breadth))
//
// The comparable is the market's own pricing: what live tokens in the same line of business are
// worth per dollar of TVL. Growth rewards a protocol whose TVL is compounding, maturity rewards
// one that has run a long time with no token (a longer record with no launch is a larger
// overhang, not a smaller one), and breadth rewards distribution across chains. Every row
// carries its breakdown, so the dashboard can show the arithmetic and the page can recompute it.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  multiple_floor: number;
  multiple_cap: number;
  min_comparables: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  breadth_step: number;
  breadth_max_extra_chains: number;
}

export const MODEL: ModelConstants = {
  multiple_floor: 0.05,
  multiple_cap: 0.5,
  min_comparables: 3,
  growth_weight: 0.6,
  growth_floor: -50,
  growth_cap: 100,
  maturity_floor: 0.7,
  maturity_range: 0.3,
  maturity_days: 1095,
  unknown_age_days: 365,
  breadth_step: 0.03,
  breadth_max_extra_chains: 4,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-2';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** One category's live-token comparable: median market cap per dollar of TVL. */
export interface Comparable {
  category: string;
  multiple: number;
  live_count: number;
}

/** The comparables table the model derives from the snapshot's live-token protocols. */
export interface Comparables {
  global_multiple: number;
  global_live_count: number;
  by_category: Comparable[];
}

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    comparable_multiple: number;
    comparable_live_count: number;
    comparable_category: string;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    breadth_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's view of one board row, with its farm plan and model breakdown. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  comparable_multiple: number;
  comparable_live_count: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  breadth_multiplier: number;
  watch: boolean;
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** A pre-token protocol the board does not rank, with the rule's reason for setting it aside. */
export interface SetAsideRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  reason: string;
}

/** Everything the dashboard needs: the board, the live set, the set-aside set, and the model. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  set_aside_size: number;
  pre_token_size: number;
  comparables: Comparables;
  rows: RadarRow[];
  live: LiveRow[];
  set_aside: SetAsideRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** The median of a non-empty list, or `fallback` when it is empty. */
function median(values: number[], fallback: number): number {
  if (values.length === 0) return fallback;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
/** Categories that are a wrapped, staked or bridged product of a token that already trades. */
const WRAPPED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);
/** A whole word in a name that says wrapped, staked or staking. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;
/** A name that begins with an exchange's name. */
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;

/**
 * Whether a protocol is one the board may rank: it records no token and passes the watchlist's
 * own rule - no wrapped, staked or bridged product, no exchange, no versioned pool. The rule is
 * the snapshot's fields only; no name is listed by hand.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  return (
    isPreToken(p) &&
    !WRAPPED_CATEGORIES.has(p.category ?? '') &&
    !VERSIONED.test(p.name) &&
    !WRAPPED_WORD.test(p.name) &&
    !EXCHANGE_PREFIX.test(p.name)
  );
}

/** Why a pre-token protocol is set aside instead of ranked, or null when it is rankable. */
export function setAsideReason(p: SnapshotProtocol): string | null {
  if (!isPreToken(p)) return null;
  if (isRankable(p)) return null;
  if (WRAPPED_CATEGORIES.has(p.category ?? '')) {
    if (p.category === 'CEX') return 'An exchange: its business is not a protocol launch.';
    return `A ${p.category} product: a wrapped, staked or bridged form of a token that already trades, not a launch of its own.`;
  }
  if (VERSIONED.test(p.name)) return 'A versioned pool: a release of another protocol, not a launch of its own.';
  if (WRAPPED_WORD.test(p.name)) return 'A wrapped or staked product: a form of a token that already trades, not a launch of its own.';
  if (EXCHANGE_PREFIX.test(p.name)) return 'An exchange product: a form of a token that already trades, not a launch of its own.';
  return 'Set aside by the watchlist rule.';
}

/**
 * The comparables: for each category, the median market cap per dollar of TVL among the
 * live-token protocols in that category (at least `min_comparables` of them), else the median
 * over all live-token protocols. Both are winsorised to [multiple_floor, multiple_cap].
 */
export function computeComparables(snapshot: Snapshot, model: ModelConstants = MODEL): Comparables {
  const live = snapshot.protocols.filter((p) => !isPreToken(p) && p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0);
  const clamp = (n: number): number => Math.min(model.multiple_cap, Math.max(model.multiple_floor, n));
  const global = clamp(median(live.map((p) => p.mcap_usd! / p.tvl_usd), 0.2));
  const byCategory: Comparable[] = [];
  const categories = [...new Set(snapshot.protocols.map((p) => p.category ?? 'Other'))].sort();
  for (const category of categories) {
    const ratios = live.filter((p) => (p.category ?? 'Other') === category).map((p) => p.mcap_usd! / p.tvl_usd);
    if (ratios.length >= model.min_comparables) {
      byCategory.push({ category, multiple: round4(clamp(median(ratios, global))), live_count: ratios.length });
    }
  }
  return { global_multiple: round4(global), global_live_count: live.length, by_category: byCategory };
}

/** The comparable multiple for one protocol's category, and how many live tokens back it. */
export function comparableFor(p: SnapshotProtocol, comparables: Comparables): { multiple: number; liveCount: number; usedCategory: string } {
  const found = comparables.by_category.find((c) => c.category === (p.category ?? 'Other'));
  if (found !== undefined) return { multiple: found.multiple, liveCount: found.live_count, usedCategory: found.category };
  return { multiple: comparables.global_multiple, liveCount: comparables.global_live_count, usedCategory: 'all live tokens' };
}

/** The four multipliers and the implied value one protocol gets under `model`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  comparables: Comparables,
  model: ModelConstants = MODEL,
): {
  implied: number;
  multiple: number;
  multipleCount: number;
  multipleCategory: string;
  growthPct: number;
  growthMult: number;
  maturityMult: number;
  breadthMult: number;
  age: number | null;
} {
  const age = ageDays(asOf, protocol.listed_at);
  const { multiple, liveCount, usedCategory } = comparableFor(protocol, comparables);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const extraChains = Math.min(Math.max(protocol.chains.length - 1, 0), model.breadth_max_extra_chains);
  const breadthMult = 1 + extraChains * model.breadth_step;
  const base = protocol.tvl_usd * multiple;
  const implied = Math.max(1, Math.round(base * growthMult * maturityMult * breadthMult));
  return { implied, multiple, multipleCount: liveCount, multipleCategory: usedCategory, growthPct, growthMult, maturityMult, breadthMult, age };
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const comparables = computeComparables(snapshot, model);
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug on it is ranked.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every other rankable pre-token protocol, below the floor or not. A chosen
  // protocol stays chosen; nothing here replaces a watchlist row.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, comparables, model);
    return { p, v };
  });
  scored.sort((a, b) => b.v.implied - a.v.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.v.age,
    implied_value_usd: s.v.implied,
    model: {
      comparable_multiple: round4(s.v.multiple),
      comparable_live_count: s.v.multipleCount,
      comparable_category: s.v.multipleCategory,
      growth_pct: round4(s.v.growthPct),
      growth_multiplier: round4(s.v.growthMult),
      maturity_multiplier: round4(s.v.maturityMult),
      breadth_multiplier: round4(s.v.breadthMult),
      age_days: s.v.age,
    },
    farm_steps: farmSteps(s.p, s.v.age).map(stepText),
  }));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 1_000_000_000) return 250;
  if (p.tvl_usd >= 100_000_000) return 150;
  if (p.tvl_usd >= 10_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 45;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** Gas for one transaction on a chain: Ethereum is dear, the rest are cheap. */
function gasFor(chain: string): string {
  return chain === 'Ethereum' ? 'about $10 of gas' : 'about $2 of gas';
}

/** What a category asks a farmer to do: the core action, the weekly action and the risk to watch. */
interface Playbook {
  core: string;
  weekly: string;
  risk: string;
  second: string;
}

function playbookFor(p: SnapshotProtocol, capital: number, chain: string): Playbook {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('collateral') || c.includes('cdp')) {
    return {
      core: `Supply $${capital} of USDC to ${name} on ${chain}, then borrow $25 of a stable asset against it so the position shows both sides of the book.`,
      weekly: 'Repay a little of the borrow and top the supply up, keeping the loan below half of the collateral.',
      risk: `Liquidation: if the collateral falls, the borrow is sold. Keep the loan-to-value under 50% and the $${capital} supply untouched for the hold.`,
      second: `Open a second, smaller supply position in a different asset on ${name} so the activity is not a single deposit.`,
    };
  }
  if (c.includes('dex') || c.includes('liquidity manager') || c.includes('leveraged farm')) {
    return {
      core: `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} in the pair the app lists first, and keep the position in range.`,
      weekly: 'Rebalance the range once a week if the price has moved it out, and collect the fees back into the pool.',
      risk: `Impermanent loss: if one side of the pair runs away, the pool returns more of the loser. Size the $${capital} so a 20% move still leaves the position worth farming.`,
      second: `Add a second pool on ${name} on the same chain, in a different pair, so the volume is spread across two markets.`,
    };
  }
  if (c.includes('risk curator') || c.includes('allocator') || c.includes('curator')) {
    return {
      core: `Deposit $${capital} into a ${name} vault on ${chain} and keep the vault shares; the curator allocates them across its underlying markets.`,
      weekly: 'Check the vault allocation once a week and move a small share to the vault with the freshest allocation if the curator opened one.',
      risk: `Curator risk: the vault follows one allocator's picks. Split the $${capital} across two of ${name}'s vaults instead of one, so a single bad allocation cannot take the whole position.`,
      second: `Deposit a second tranche into another ${name} vault on ${chain} with a different risk profile.`,
    };
  }
  if (c.includes('rwa')) {
    return {
      core: `Mint $${capital} of ${name}'s yield-bearing asset on ${chain} and hold it in the farming wallet for the full hold.`,
      weekly: 'Claim the yield the asset accrues once a week and restake it into the same asset, keeping the balance growing.',
      risk: `Issuer risk: the asset is only as sound as its off-chain backing. Read ${name}'s own attestations before minting, and keep the $${capital} to money you can leave locked.`,
      second: `Mint a second, smaller tranche of the same asset after the first week, so the record shows repeated minting rather than one trade.`,
    };
  }
  if (c.includes('yield') || c.includes('farm')) {
    return {
      core: `Deposit $${capital} into ${name}'s highest-TVL yield position on ${chain} and stake the receipt token the app issues for it.`,
      weekly: 'Harvest the yield once a week and compound it back into the same position instead of selling it.',
      risk: `Emission risk: a yield that falls to zero leaves only the deposit. Check the position's rate each week and move the $${capital} only if the app's own page shows the rewards have stopped.`,
      second: `Open a second yield position on ${name} in a different pool, so the record shows two strategies rather than one deposit.`,
    };
  }
  if (c.includes('derivative') || c.includes('perpetual') || c.includes('basis')) {
    return {
      core: `Deposit $${capital} of USDC as margin on ${name} on ${chain} and open one small hedged position, long the market and short the same size elsewhere.`,
      weekly: 'Close and reopen the hedge once a week so the funding the position pays or earns is recorded as activity.',
      risk: `Funding risk: a hedge that pays funding every hour bleeds the $${capital}. Keep the position small, check the funding rate before opening, and close it if the rate turns against you for a full day.`,
      second: `Open a second small hedge on ${name} in a different market, so the volume is not one trade repeated.`,
    };
  }
  if (c.includes('staking') || c.includes('restak')) {
    return {
      core: `Stake $${capital} of the chain's staking asset through ${name} on ${chain} and keep the receipt token in the farming wallet.`,
      weekly: 'Restake the staking rewards once a week so the staked balance compounds.',
      risk: `Slashing and lock-up risk: staked funds can be cut or locked. Keep the $${capital} staked through ${name}'s own app and do not stake funds you need back this month.`,
      second: `Stake a second tranche through ${name} after the first week, so the record shows repeated staking.`,
    };
  }
  if (c.includes('stable') || c.includes('cdp manager')) {
    return {
      core: `Mint $${capital} of the stable asset through ${name} on ${chain} against collateral, keeping the collateral ratio the app recommends.`,
      weekly: 'Check the collateral ratio once a week and top it up if the market moved it toward the liquidation line.',
      risk: `Depeg risk: if the stable asset slips below its peg, the position loses value on both sides. Keep the $${capital} mint small relative to the collateral and watch the peg weekly.`,
      second: `Use the minted stable asset in a second ${name} position, such as a savings or liquidity pool, so the mint is used rather than idle.`,
    };
  }
  if (c.includes('prediction')) {
    return {
      core: `Fund $${capital} on ${name} on ${chain} and place one position on a market that settles after the hold, not one that ends this week.`,
      weekly: 'Place one new small position each week on a different market, keeping each one under $25.',
      risk: `A prediction market can go to zero. Keep every position under $25 and the $${capital} total as the budget, never as money you need back.`,
      second: `Add liquidity to one ${name} market instead of only taking positions, so the record shows both sides.`,
    };
  }
  if (c.includes('insurance')) {
    return {
      core: `Buy $${capital} of cover from ${name} on ${chain} for a protocol you already use, and keep the policy for the full hold.`,
      weekly: 'Check the policy once a week and file nothing unless a covered event happens; the cover itself is the activity.',
      risk: `Claim risk: cover pays only on the events its policy names. Read what ${name} covers before buying, and keep the $${capital} policy as the farm, not as a bet.`,
      second: `Buy a second, smaller cover on ${name} for a different protocol, so the record shows two policies.`,
    };
  }
  if (c.includes('index')) {
    return {
      core: `Buy $${capital} of ${name}'s index token on ${chain} and hold it in the farming wallet for the full hold.`,
      weekly: 'Check the index composition once a week and add a small amount if the index rebalanced into a new asset.',
      risk: `Basket risk: the index follows its holdings. A $${capital} index position moves with the whole basket, so size it as one position, not as a hedge.`,
      second: `Buy a second tranche of the index token after the first week, so the record shows accumulation.`,
    };
  }
  if (c.includes('payment') || c.includes('card')) {
    return {
      core: `Fund $${capital} into ${name} on ${chain} and make one real payment with it, keeping the receipt in the farm log.`,
      weekly: 'Make one small payment a week through ${name}, on a different merchant or recipient each time.',
      risk: `Counterparty risk: funds held for payments sit with ${name}. Keep only the $${capital} you plan to spend in the account and move the rest back to your own wallet.`,
      second: `Set up a recurring payment through ${name} so the record shows repeated use rather than one transfer.`,
    };
  }
  return {
    core: `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open for the full hold.`,
    weekly: 'Make one qualifying action each week, such as a deposit, a swap, a vote or a claim, and keep the position open between them.',
    risk: `Smart-contract risk: the $${capital} sits in ${name}'s contracts. Read the app's own audit note before depositing, and keep the position to money you can leave in the protocol.`,
    second: `Open a second position on ${name} on ${chain} in a different pool or vault, so the record shows depth rather than one deposit.`,
  };
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time. The plan is
 * derived from the protocol's own record (category, chains, TVL, age, growth), never from a
 * hand-written list of names: the category picks the playbook, the TVL picks the capital, the
 * age picks the hold, the chain picks the gas, and a multi-chain protocol gets a cross-chain step.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const name = p.name;
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const gas = gasFor(chain);
  const book = playbookFor(p, capital, chain);
  const secondChain = p.chains.length > 1 ? p.chains[1]! : null;
  const growthNote =
    p.change_7d !== null && p.change_7d > 20
      ? `TVL is up ${p.change_7d.toFixed(1)}% in 7 days, so enter in two tranches a week apart rather than all at once.`
      : `TVL moved ${p.change_7d === null ? 'an unreported amount' : `${p.change_7d.toFixed(1)}%`} in 7 days, so enter in one tranche and watch the next weekly figure.`;
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline. Bridge $${capital} of USDC to ${chain} for the position. ${growthNote}`,
      cost: `${gas} for the first transaction, plus the bridge fee`,
      time: '15 minutes to set up',
    },
    { text: book.core, cost: `$${capital} of capital and ${gas}`, time: '15 minutes to set up' },
    {
      text: secondChain === null ? book.second : `Repeat the core position on ${secondChain} with $25 of USDC, so the farm covers two of ${name}'s ${p.chains.length} chains instead of one.`,
      cost: secondChain === null ? `$25 of extra capital and ${gas}` : `$25 of extra capital and about $2 of gas on ${secondChain}`,
      time: '10 minutes',
    },
    {
      text: book.weekly,
      cost: `${gas} a week`,
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot, and check ${name}'s own points or rewards page once a week for tasks the protocol itself publishes.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: book.risk,
      cost: 'nothing but attention',
      time: '10 minutes a week',
    },
    {
      text: `Before you withdraw, open ${name}'s own points or rewards page and claim only from the link it publishes, never from a link in a message. Write the wallet, the dates and every transaction in a farm log.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes to claim, 5 minutes to log',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** The pre-token protocols the board sets aside, by TVL, with the rule's reason each time. */
export function setAsideRows(snapshot: Snapshot): SetAsideRow[] {
  return snapshot.protocols
    .filter((p) => isPreToken(p) && !isRankable(p))
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      change_7d: p.change_7d,
      reason: setAsideReason(p) ?? 'Set aside by the watchlist rule.',
    }));
}

/** A board row's form for data.js, with its farm plan and model breakdown. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    comparable_multiple: row.model.comparable_multiple,
    comparable_live_count: row.model.comparable_live_count,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    breadth_multiplier: row.model.breadth_multiplier,
    watch: false,
    farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const setAside = setAsideRows(snapshot);
  const preToken = snapshot.protocols.filter(isPreToken).length;
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    set_aside_size: setAside.length,
    pre_token_size: preToken,
    comparables: computeComparables(snapshot, model),
    rows: board.map((r) => ({ ...radarRow(r), watch: snapshot.watchlist.includes(r.slug) })),
    live,
    set_aside: setAside,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
