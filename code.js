(function HEADER_FOOTER_HANDLER() {
    const SCROLL_TOLERANCE = 0.02;

    const header = document.querySelector('header');
    const footer = document.querySelector('footer');
    const greeter = document.getElementById('greeter');

    const greeters = ['Traveler', 'Voyager', 'Globetrotter', 'Tourist', 'Wanderer', 'Explorer', 'Wayfarer'];

    window.addEventListener('DOMContentLoaded', () => {
        greeter.textContent = greeters[Math.floor(Math.random() * greeters.length)];
        // visibility timing is handled by the intro sequencer below, not here
    });

    window.addEventListener('scroll', () => {
        const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrollProgress = scrollableHeight > 0 ? window.scrollY / scrollableHeight : 0;

        if (scrollProgress > SCROLL_TOLERANCE) {
            header.classList.add('header-hidden');
        } else {
            header.classList.remove('header-hidden');
        }

        if (scrollProgress >= 1 - SCROLL_TOLERANCE) {
            footer.classList.add('footer-shown');
        } else {
            footer.classList.remove('footer-shown');
        }
    });
})();

(function SIGNPOST_HANDLER() {
    const signpost = document.getElementById('signpost');

    window.addEventListener('scroll', () => {
        document.querySelector('#signpost rect').classList.add('grown');
        signpost.classList.add('grown');
    }, {once: true});

    const svg = document.querySelector('#signpost svg');
    const poleRect = document.querySelector('#signpost rect');
    const POLE_X = 100; // center of pole, matches viewBox 200-wide, pole centered at x=100
    // the pole rect doesn't start at y=0 (it has its own y attribute), so the
    // real visible cutoff is the rect's top plus its initial un-grown height
    const INITIAL_VISIBLE_Y = parseFloat(poleRect.getAttribute('y')) + 60; // 60 matches #signpost rect's un-grown CSS height
    const SIGN_START_Y = 30;
    const SIGN_GAP = 6; // vertical gap between stacked signs on the same side
    const SIGN_WIDTH = 70;
    const SIGN_HEIGHT = 16; // base/minimum height (single line)
    const SIGN_POINT = 6; // how far the arrow tip juts out
    const MAX_CHARS_PER_LINE = 10; // 'Loading...' == 10, leaves a little headroom
    const LINE_HEIGHT = 12; // px between wrapped lines
    const FONT_SIZE = 11;

    let signCount = 0;
    // running bottom-Y per side, so a taller sign pushes the next same-side sign down
    const nextY = { right: SIGN_START_Y, left: SIGN_START_Y };

    const BOTTOM_PADDING = 20; // breathing room below the lowest sign, in viewBox units
    const viewBoxParts = svg.getAttribute('viewBox').split(' ').map(Number);
    const [VB_X, VB_Y, VB_WIDTH] = viewBoxParts;
    // #signpost's CSS width stays fixed; height is derived to match viewBox's aspect ratio
    const containerWidthPx = signpost.getBoundingClientRect().width || parseFloat(getComputedStyle(signpost).width);

    // Recalculate the SVG's viewBox height and the container's CSS height so
    // the signpost always fits whatever content has actually been drawn,
    // instead of the original fixed viewBox/CSS dimensions.
    const POLE_Y = parseFloat(poleRect.getAttribute('y'));
    const POLE_HEIGHT_GROWN = 180; // matches #signpost rect.grown CSS height

    function resizeSignpost() {
        const poleBottom = POLE_Y + POLE_HEIGHT_GROWN;
        const tallestBottom = Math.max(nextY.right, nextY.left, poleBottom);
        const newViewBoxHeight = tallestBottom + BOTTOM_PADDING;

        svg.setAttribute('viewBox', `${VB_X} ${VB_Y} ${VB_WIDTH} ${newViewBoxHeight}`);

        // keep the container's rendered aspect ratio matching the new viewBox
        // so the SVG doesn't get stretched or letterboxed
        const scale = containerWidthPx / VB_WIDTH;
        signpost.style.height = `${newViewBoxHeight * scale}px`;
    }

    // set an initial size immediately - without this, the container sits at
    // whatever default sizing the browser gives an unsized SVG until the
    // first addSign()/clearSigns() call, which may never come
    resizeSignpost();

    // Wrap text into lines: split on words first, and if a single word
    // still doesn't fit on its own line, hard-split it by character.
    function wrapText(text, maxChars) {
        const words = text.split(/\s+/).filter(Boolean);
        const lines = [];
        let current = '';

        function flushCurrent() {
            if (current.length) {
                lines.push(current);
                current = '';
            }
        }

        for (const word of words) {
            if (word.length > maxChars) {
                // word alone is too long - flush what we have, then hard-split the word
                flushCurrent();
                let remaining = word;
                while (remaining.length > maxChars) {
                    lines.push(remaining.slice(0, maxChars));
                    remaining = remaining.slice(maxChars);
                }
                current = remaining; // leftover chunk continues accumulating words
                continue;
            }

            const candidate = current ? `${current} ${word}` : word;
            if (candidate.length > maxChars) {
                flushCurrent();
                current = word;
            } else {
                current = candidate;
            }
        }
        flushCurrent();

        return lines.length ? lines : [''];
    }

    function addSign(text) {
        const index = signCount++;
        const side = index % 2 === 0 ? 'right' : 'left'; // alternate sides

        const lines = wrapText(text, MAX_CHARS_PER_LINE);
        const signHeight = Math.max(SIGN_HEIGHT, lines.length * LINE_HEIGHT + 6);
        const leftOffset = side === 'left' ? signHeight / 2 : 0; // stagger left signs down by half their own height

        const y = nextY[side];
        nextY[side] = y + signHeight + leftOffset + SIGN_GAP; // stack next same-side sign below this one's real bottom edge (including its offset)

        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.classList.add('signpost-sign');
        g.dataset.side = side;
        g.style.cursor = 'pointer';

        // signs whose bottom edge falls below the pole's initial (un-grown)
        // visible bound start invisible and fade in once the post expands
        if (y + signHeight + leftOffset > INITIAL_VISIBLE_Y) {
            g.classList.add('sign-hidden');
        }

        const points = side === 'right'
            ? signPointsRight(POLE_X, y, signHeight)
            : signPointsLeft(POLE_X - 10, y, leftOffset, signHeight);

        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        polygon.setAttribute('points', points);
        polygon.setAttribute('fill', 'rgba(0,0,0,0)');
        polygon.setAttribute('stroke', 'var(--brdr-shadow)');
        polygon.setAttribute('stroke-width', '2');
        polygon.setAttribute('stroke-linejoin', 'round'); // softens the arrow corners

        const textX = side === 'right' ? POLE_X + 4 : POLE_X - 14;
        const textAnchor = side === 'right' ? 'start' : 'end';

        // vertically center the block of lines within signHeight
        const blockHeight = lines.length * LINE_HEIGHT;
        const firstLineY = y + (signHeight - blockHeight) / 2 + LINE_HEIGHT - 3 + leftOffset;

        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', textX);
        label.setAttribute('y', firstLineY);
        label.setAttribute('text-anchor', textAnchor);
        label.setAttribute('fill', 'var(--txt-normal)');
        label.setAttribute('font-size', String(FONT_SIZE));

        lines.forEach((line, i) => {
            const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
            tspan.setAttribute('x', textX);
            tspan.setAttribute('dy', i === 0 ? '0' : String(LINE_HEIGHT));
            tspan.textContent = line;
            label.appendChild(tspan);
        });

        g.appendChild(polygon);
        g.appendChild(label);

        svg.appendChild(g);
        resizeSignpost();
        return g;
    }

    function clearSigns() {
        svg.querySelectorAll('.signpost-sign').forEach(g => g.remove());
        signCount = 0;
        nextY.right = SIGN_START_Y;
        nextY.left = SIGN_START_Y;
        resizeSignpost();
    }

    // arrow pointing right, tip juts out to the right of the pole
    function signPointsRight(poleX, y, height) {
        const x0 = poleX;
        const x1 = poleX + SIGN_WIDTH;
        const xTip = x1 + SIGN_POINT;
        const yMid = y + height / 2;
        return `${x0},${y} ${x1},${y} ${xTip},${yMid} ${x1},${y + height} ${x0},${y + height}`;
    }

    // arrow pointing left, tip juts out to the left of the pole
    function signPointsLeft(poleX, y, offset, height) {
        const x0 = poleX;
        const x1 = poleX - SIGN_WIDTH;
        const xTip = x1 - SIGN_POINT;
        const yMid = y + height / 2 + offset;
        return `${x0},${y + offset} ${x1},${y + offset} ${xTip},${yMid} ${x1},${y + height + offset} ${x0},${y + height + offset}`;
    }

    // expose globally so you can call it from anywhere, e.g. addSign('Blog')
    window.addSign = addSign;
    window.clearSigns = clearSigns;

})();

(function INTRO_SEQUENCER() {
    const STEP_DELAY = 500; // ms between each step of the sequence
    const WORD_DELAY = 150; // ms between each word within a word-by-word paragraph

    const welcomeH1 = document.querySelector('header h1:not(#greeter)');
    const greeterH1 = document.getElementById('greeter');
    const introLanded = document.getElementById('intro-landed');
    const introChoose = document.getElementById('intro-choose');
    const signpost = document.getElementById('signpost');
    const safeTravels = document.getElementById('safe-travels');
    const bonVoyage = document.getElementById('bon-voyage');
    const footerP = document.querySelector('footer p');

    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // splits a paragraph's own text content into one <span class="fade-target">
    // per word, preserving spacing between words. The parent itself is
    // revealed immediately after wrapping - it has no visible content of its
    // own anymore (only the child spans do), so its own opacity must be 1 or
    // it clips every child span regardless of the child's own opacity.
    function wrapWords(el) {
        const text = el.textContent;
        el.textContent = '';
        const words = text.split(' ');
        const spans = words.map((word, i) => {
            const span = document.createElement('span');
            span.className = 'fade-target';
            span.textContent = word;
            el.appendChild(span);
            if (i < words.length - 1) {
                el.appendChild(document.createTextNode(' '));
            }
            return span;
        });
        el.classList.add('visible');
        return spans;
    }

    async function revealWordByWord(spans) {
        for (const span of spans) {
            span.classList.add('visible');
            await wait(WORD_DELAY);
        }
    }

    function reveal(el) {
        el.classList.add('visible');
    }

    async function runIntroSequence() {
        const landedSpans = wrapWords(introLanded);
        const chooseSpans = wrapWords(introChoose);
        const safeTravelsSpans = wrapWords(safeTravels);
        const bonVoyageSpans = wrapWords(bonVoyage);
        const footerSpans = wrapWords(footerP);

        reveal(welcomeH1);
        await wait(STEP_DELAY);

        reveal(greeterH1);
        await wait(STEP_DELAY);

        await revealWordByWord(landedSpans);
        await wait(STEP_DELAY);

        await revealWordByWord(chooseSpans);
        await wait(STEP_DELAY);

        // the whole signpost fades in as one unit; signs already marked
        // sign-hidden (collapsed post) stay invisible via their own existing rule
        reveal(signpost);
        await wait(STEP_DELAY);

        await revealWordByWord(safeTravelsSpans);
        await wait(STEP_DELAY);

        await revealWordByWord(bonVoyageSpans);
        await wait(STEP_DELAY);

        await revealWordByWord(footerSpans);
    }

    window.addEventListener('DOMContentLoaded', runIntroSequence);
})();

(function CARD_SYSTEM() {
    const stackEl = document.getElementById('card-stack');

    const CARD_LIFETIME = 4000; // ms a card stays visible before despawning
    const CARD_GAP = 12; // px between stacked cards
    const MAX_VISIBLE_CARDS = 4; // oldest card is force-despawned if this is exceeded
    const DESPAWN_ANIMATION_TIME = 350; // ms, must match .stack-card transition duration in CSS

    // ordered oldest -> newest; oldest is always index 0 (top of visual stack,
    // despawns first - either by its own timer or by forced eviction)
    const stack = [];
    let nextCardId = 0;

    // recalculates every visible card's vertical offset based on the
    // cumulative height of the cards below it (newer cards sit lower)
    function repositionStack() {
        let cumulativeHeight = 0;
        // iterate newest -> oldest so each card stacks on top of the ones below it
        for (let i = stack.length - 1; i >= 0; i--) {
            const card = stack[i];
            card.el.style.bottom = `${cumulativeHeight}px`;
            cumulativeHeight += card.el.offsetHeight + CARD_GAP;
        }
    }

    function despawnCard(cardEntry) {
        if (cardEntry.despawning) return; // already in the process of leaving
        cardEntry.despawning = true;

        clearTimeout(cardEntry.timer);
        cardEntry.el.classList.remove('visible');
        cardEntry.el.classList.add('despawning');

        setTimeout(() => {
            cardEntry.el.remove();
            const idx = stack.indexOf(cardEntry);
            if (idx !== -1) stack.splice(idx, 1);
            repositionStack();
        }, DESPAWN_ANIMATION_TIME);
    }

    // Show a generic stacked card. `colors` optionally overrides the three
    // theme colors: { bg, txt, brdr }. `description` is optional.
    function showCard({ title, description = '', colors = {} } = {}) {
        const el = document.createElement('div');
        el.className = 'stack-card';
        el.dataset.cardId = nextCardId++;

        if (colors.bg) el.style.setProperty('--card-bg', colors.bg);
        if (colors.txt) el.style.setProperty('--card-txt', colors.txt);
        if (colors.brdr) el.style.setProperty('--card-brdr', colors.brdr);

        const titleEl = document.createElement('p');
        titleEl.className = 'stack-card-title';
        titleEl.textContent = title;
        el.appendChild(titleEl);

        if (description) {
            const descEl = document.createElement('p');
            descEl.className = 'stack-card-description';
            descEl.textContent = description;
            el.appendChild(descEl);
        }

        stackEl.appendChild(el);

        const cardEntry = { el, despawning: false, timer: null };
        stack.push(cardEntry);

        // force-evict the oldest still-active cards immediately if we're over
        // the cap. Removal from `stack` happens asynchronously (after the
        // despawn animation), so we track how many are already mid-despawn
        // rather than re-checking stack.length, which wouldn't shrink in time.
        const activeCards = stack.filter(c => !c.despawning);
        let overflow = activeCards.length - MAX_VISIBLE_CARDS;
        for (let i = 0; overflow > 0 && i < activeCards.length; i++) {
            if (activeCards[i].despawning) continue;
            despawnCard(activeCards[i]);
            overflow--;
        }

        cardEntry.timer = setTimeout(() => despawnCard(cardEntry), CARD_LIFETIME);

        // reveal on the next frame so the enter transition actually plays
        requestAnimationFrame(() => {
            el.classList.add('visible');
            repositionStack();
        });

        return cardEntry;
    }

    window.showCard = showCard;
})();

(function ACHIEVEMENT_SYSTEM() {
    // Each level's bg/txt/brdr feed directly into showCard's `colors` override.
    // bg is a dark tint of the theme hue (so text stays readable), brdr is the
    // full-saturation theme color, txt is a light tint of the same hue.
    const ACHIEVEMENT_LEVELS = {
        common:      { name: 'Common',       bg: '#1a2e05', txt: '#e3ffb8', brdr: '#84cc16' }, // lime
        uncommon:    { name: 'Uncommon',     bg: '#052e16', txt: '#bbf7d0', brdr: '#20c35c' }, // forest green
        rare:        { name: 'Rare',         bg: '#0c1a2e', txt: '#bfdbfe', brdr: '#3b82f6' }, // blue
        super_rare:  { name: 'Super Rare',   bg: '#1a1433', txt: '#c7d2fe', brdr: '#6366f1' }, // indigo
        epic:        { name: 'Epic',         bg: '#2a0e3d', txt: '#e9d5ff', brdr: '#a855f7' }, // purple
        mythic:      { name: 'Mythic',       bg: '#052e30', txt: '#bcf7fa', brdr: '#22d3ee' }, // cyan
        legendary:   { name: 'Legendary',    bg: '#332701', txt: '#fef3c7', brdr: '#eab308' }, // gold
        transcendent:{ name: 'Transcendent', bg: '#330606', txt: '#fecaca', brdr: '#ef4444' }, // red
        eternal:     { name: 'Eternal',      bg: '#1c1c1c', txt: '#cccccc', brdr: '#ffffff' }, // white
    };

    // Central index of every achievement that exists in the game - the single
    // source of truth for what a name's rarity is. unlockAchievement/
    // giveAchievement take only a name and look everything else up from here.
    // Add new achievements here, not inline at the call site.
    const ACHIEVEMENT_REGISTRY = {
        'Newcomer': { rarity: 'common' },
        'Cheater':  { rarity: 'rare' },
        'Mistake?': { rarity: 'super_rare' },
        'Master Programmer': { rarity: 'super_rare' },
    };

    const STORAGE_KEY = 'earnedAchievements';

    // name is the stable key used for storage/lookups - it's also the
    // registry key, so renaming an achievement in ACHIEVEMENT_REGISTRY is
    // itself effectively minting a new achievement. Stored as an array of
    // {name, rarity, viaConsole} objects so anything reading storage later
    // has enough to display without re-deriving from the registry.
    function loadEarned() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            const entries = Array.isArray(parsed)
                ? parsed.filter(e => e && typeof e.name === 'string')
                : [];
            return new Map(entries.map(e => [e.name, e]));
        } catch (e) {
            // corrupted/blocked storage shouldn't break the achievement system -
            // just treat it as "nothing earned yet" for this session
            console.warn('unlockAchievement: could not read localStorage', e);
            return new Map();
        }
    }

    function saveEarned(earnedMap) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify([...earnedMap.values()]));
        } catch (e) {
            console.warn('unlockAchievement: could not write localStorage', e);
        }
    }

    const earned = loadEarned();

    function hasAchievement(name) {
        return earned.has(name);
    }

    // wipes all earned achievements, in-memory and in storage. Does not
    // touch the card UI - callers decide what (if anything) to show after.
    function clearAchievements() {
        earned.clear();
        saveEarned(earned);
    }

    // removes a single earned achievement. Returns true if it was actually
    // earned (and thus removed), false if there was nothing to remove.
    function removeAchievement(name) {
        if (!earned.has(name)) return false;
        earned.delete(name);
        saveEarned(earned);
        return true;
    }

    // Looks up rarity from the central registry - callers no longer pass it.
    // `viaConsole` tags how the achievement was obtained (dev console `give`
    // vs. normal gameplay); it's stored but not surfaced anywhere on its own,
    // only through the `legit?` console command.
    function unlockAchievement(name, viaConsole = false) {
        if (earned.has(name)) return; // already earned - no card, no re-save

        const registryEntry = ACHIEVEMENT_REGISTRY[name];
        if (!registryEntry) {
            console.warn(`unlockAchievement: unknown achievement "${name}"`);
            return;
        }

        const level = ACHIEVEMENT_LEVELS[registryEntry.rarity];
        if (!level) {
            console.warn(`unlockAchievement: unknown rarity "${registryEntry.rarity}" for "${name}"`);
            return;
        }

        earned.set(name, { name, rarity: registryEntry.rarity, viaConsole });
        saveEarned(earned);

        window.showCard({
            title: name,
            description: level.name,
            colors: { bg: level.bg, txt: level.txt, brdr: level.brdr }
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        unlockAchievement('Newcomer');
    });

    // returns the earned achievements as plain data (array of {name, rarity,
    // viaConsole}), for anything - like the dev console - that wants to read
    // them without reaching into localStorage or the module's private Map
    function getEarnedRaw() {
        return [...earned.values()];
    }

    window.ACHIEVEMENT_LEVELS = ACHIEVEMENT_LEVELS;
    window.ACHIEVEMENT_REGISTRY = ACHIEVEMENT_REGISTRY;
    window.unlockAchievement = unlockAchievement;
    window.hasAchievement = hasAchievement;
    window.clearAchievements = clearAchievements;
    window.removeAchievement = removeAchievement;
    window.getEarnedRaw = getEarnedRaw;
})();

(function KONAMI_CODE() {
    const CODE = [
        'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
        'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
        'b', 'a'
    ];

    let progress = 0;

    window.addEventListener('keydown', (e) => {
        // case-insensitive match on letter keys ('b'/'a'), exact match on arrow keys
        const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
        const expected = CODE[progress];

        if (key === expected) {
            progress++;
            if (progress === CODE.length) {
                progress = 0;
                window.clearAchievements();
                window.unlockAchievement('Cheater');
            }
        } else {
            // wrong key - restart, but allow it to be the first key of a fresh attempt
            progress = (key === CODE[0]) ? 1 : 0;
        }
    });
})();

(function REVERSE_KONAMI_CODE() {
    // reverse of the Konami code: d,d,u,u,l,r,l,r,a,b using arrow keys
    const CODE = [
        'ArrowDown', 'ArrowDown', 'ArrowUp', 'ArrowUp',
        'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
        'a', 'b'
    ];

    let progress = 0;

    window.addEventListener('keydown', (e) => {
        const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
        const expected = CODE[progress];

        if (key === expected) {
            progress++;
            if (progress === CODE.length) {
                progress = 0;
                window.unlockAchievement('Mistake?');
                window.openDevConsole();
            }
        } else {
            progress = (key === CODE[0]) ? 1 : 0;
        }
    });
})();

(function DEV_CONSOLE() {
    const PROMPT = '>';

    // built lazily on first open, not at IIFE init - keeps it out of the DOM
    // entirely for anyone who never finds the reverse-Konami code
    let consoleEl = null;
    let outputEl = null;
    let inputEl = null;

    // if set, the next line submitted is treated as a yes/no answer to this
    // pending destructive command instead of being parsed as a new command
    let pendingConfirmation = null; // { run, prompt }

    function formatAchievementLine(a) {
        const levels = window.ACHIEVEMENT_LEVELS;
        const levelName = levels[a.rarity] ? levels[a.rarity].name : a.rarity;
        return `${a.name} — ${levelName}`;
    }

    // Static commands are unlisted, single-token "magic word" commands -
    // they don't show up in `dev help` or `dev describe`, and they aren't
    // parsed as `category subcommand args` like everything else. Each key is
    // the literal static beginning the whole input line must start with
    // (e.g. 'hello_world' or '???'); anything typed after that prefix is
    // passed to `run` as a single trimmed param string - ignored if the
    // handler doesn't need it, used if it does (e.g. 'hello_world!!!' ->
    // param is '!!!'). Matching checks the longest prefix first, so one
    // static command being a prefix of another can never shadow it.
    // `run` returns a string (or array of strings) to print, or
    // null/undefined to print nothing - same contract as CATEGORIES' run.
    const STATIC_COMMANDS = {
        'hello_world': {
            run: () => {
                window.unlockAchievement('Master Programmer');
                return 'Hello, world!';
            },
        },
        '???': {
            run: () => 'Coming soon.',
        },
    };

    // Each category is a map of subcommand -> { run(args), description,
    // destructive }. `run` returns a string (or array of strings) to print,
    // or null/undefined to print nothing. `destructive` commands go through
    // the confirmation flow instead of running immediately.
    const CATEGORIES = {
        achievements: {
            list: {
                description: 'Lists all earned achievements and their rarities.',
                run: () => {
                    const earned = window.getEarnedRaw();
                    if (earned.length === 0) return 'No achievements earned yet.';
                    // pre-reversed for the same reason as dev help - see its comment
                    return earned.map(formatAchievementLine).reverse();
                },
            },
            give: {
                description: 'give [achievement-name] — gives yourself the named achievement.',
                run: (args) => {
                    const name = args.join(' ');
                    if (!name) return 'Usage: achievements give [achievement-name]';
                    if (!window.ACHIEVEMENT_REGISTRY[name]) return `No such achievement: ${name}`;
                    if (window.hasAchievement(name)) return `Already earned: ${name}`;

                    window.unlockAchievement(name, /* viaConsole */ true);
                    return `Gave achievement: ${name}`;
                },
            },
            remove: {
                description: 'remove [achievement-name] — removes the named achievement if earned. Destructive - asks for confirmation.',
                destructive: true,
                confirmPrompt: (args) => `This will remove "${args.join(' ')}" if earned. Type y/n:`,
                run: (args) => {
                    const name = args.join(' ');
                    if (!name) return 'Usage: achievements remove [achievement-name]';
                    const removed = window.removeAchievement(name);
                    return removed ? `Removed achievement: ${name}` : `Not earned: ${name}`;
                },
            },
            clear: {
                description: 'Clears all saved achievements. Destructive - asks for confirmation.',
                destructive: true,
                confirmPrompt: 'This will clear ALL earned achievements. Type y/n:',
                run: () => {
                    window.clearAchievements();
                    return 'All achievements cleared.';
                },
            },
            'legit?': {
                description: 'legit? [achievement-name] — checks if an achievement is earned, and if so, whether it was earned legitimately or via the dev console.',
                run: (args) => {
                    const name = args.join(' ');
                    if (!name) return 'Usage: achievements legit? [achievement-name]';
                    if (!window.ACHIEVEMENT_REGISTRY[name]) return `No such achievement: ${name}`;

                    const earned = window.getEarnedRaw().find(a => a.name === name);
                    if (!earned) return `${name}: not earned.`;

                    return earned.viaConsole
                        ? `${name}: earned, but NOT legit (given via dev console).`
                        : `${name}: earned legitimately.`;
                },
            },
        },
        dev: {
            help: {
                description: 'Lists all available commands.',
                run: () => {
                    const lines = [];
                    const catNames = Object.keys(CATEGORIES);

                    catNames.forEach((catName, i) => {
                        lines.push(`${catName}:`);
                        for (const [subName, command] of Object.entries(CATEGORIES[catName])) {
                            lines.push(`  ${catName} ${subName} — ${command.description}`);
                        }
                        if (i < catNames.length - 1) lines.push(''); // blank line between categories
                    });

                    // printResult reverses whatever array it's given (so
                    // chronological multi-line command output stacks correctly
                    // above the input row). help's lines aren't chronological -
                    // they're a structured list - so pre-reverse here to cancel
                    // that out and keep categories/subcommands in reading order.
                    return lines.reverse();
                },
            },
            describe: {
                description: 'describe [category] [command] — gives a description of the command.',
                run: (args) => {
                    const [catName, subName] = args;
                    if (!catName || !subName) return 'Usage: dev describe [category] [command]';

                    const category = CATEGORIES[catName];
                    if (!category) return `No such category: ${catName}`;

                    const command = category[subName];
                    if (!command) return `No such command: ${catName} ${subName}`;

                    return command.description;
                },
            },
            out: {
                description: 'Exits the dev console.',
                run: () => {
                    clearOutput();
                    // closes on the next tick - if it closes synchronously here,
                    // the console closes mid-keydown-handler while still holding focus
                    setTimeout(closeDevConsole, 0);
                    return null;
                },
            },
            clear: {
                description: 'Clears the console output.',
                run: () => {
                    clearOutput();
                    return null;
                },
            },
        },
    };

    function buildConsole() {
        const el = document.createElement('div');
        el.id = 'dev-console';

        // input row first in DOM, output second - CSS flex-direction: column-reverse
        // keeps the input visually pinned at the bottom while output grows upward
        const inputRow = document.createElement('div');
        inputRow.id = 'dev-console-input-row';

        const prompt = document.createElement('span');
        prompt.id = 'dev-console-prompt';
        prompt.textContent = PROMPT;
        inputRow.appendChild(prompt);

        const input = document.createElement('input');
        input.id = 'dev-console-input';
        input.type = 'text';
        input.autocomplete = 'off';
        input.spellcheck = false;
        inputRow.appendChild(input);

        el.appendChild(inputRow);

        const output = document.createElement('div');
        output.id = 'dev-console-output';
        el.appendChild(output);

        document.body.appendChild(el);

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeDevConsole();
                return;
            }
            if (e.key !== 'Enter') return;

            const raw = input.value;
            input.value = '';
            printLine(`${PROMPT} ${raw}`);

            handleSubmit(raw.trim());
        });

        return { el, output, input };
    }

    function handleSubmit(text) {
        if (pendingConfirmation) {
            handleConfirmationAnswer(text);
            return;
        }

        if (!text) return;
        runCommand(text);
    }

    function handleConfirmationAnswer(text) {
        const answer = text.trim().toLowerCase();
        const confirmed = pendingConfirmation;
        pendingConfirmation = null;

        if (answer === 'y' || answer === 'yes') {
            printResult(confirmed.run());
        } else {
            printLine('Cancelled.');
        }
    }

    // Checks `text` against STATIC_COMMANDS, longest prefix first (so a
    // static command that happens to be a prefix of a longer one - none
    // currently, but future-proofing - can't shadow the longer match).
    // Returns { command, param } on a hit, or null if nothing matches.
    function matchStaticCommand(text) {
        const prefixes = Object.keys(STATIC_COMMANDS).sort((a, b) => b.length - a.length);
        for (const prefix of prefixes) {
            if (text.startsWith(prefix)) {
                return { command: STATIC_COMMANDS[prefix], param: text.slice(prefix.length).trim() };
            }
        }
        return null;
    }

    function runCommand(text) {
        const staticMatch = matchStaticCommand(text);
        if (staticMatch) {
            printResult(staticMatch.command.run(staticMatch.param));
            return;
        }

        const [catName, subName, ...args] = text.split(/\s+/);

        // a bare y/n/yes/no with nothing else typed and no pending
        // confirmation is almost always a stray leftover keystroke from
        // answering an earlier prompt, not an actual attempt at a category
        // named "y" - give a clearer message than "Unknown category: y"
        if (!subName && /^(y|yes|n|no)$/i.test(catName)) {
            printLine('Nothing to confirm right now.');
            return;
        }

        const category = CATEGORIES[catName];
        if (!category) {
            printLine(`Unknown category: ${catName}`);
            return;
        }

        const command = category[subName];
        if (!command) {
            printLine(`Unknown command: ${catName} ${subName || ''}`.trim());
            return;
        }

        if (command.destructive) {
            pendingConfirmation = { run: () => command.run(args) };
            const prompt = typeof command.confirmPrompt === 'function'
                ? command.confirmPrompt(args)
                : (command.confirmPrompt || 'Are you sure? Type y/n:');
            printLine(prompt);
            return;
        }

        printResult(command.run(args));
    }

    // accepts a string, an array of strings, or null/undefined and prints
    // each resulting line, newest closest to the input row (see column-reverse)
    function printResult(result) {
        if (result == null) return;
        const lines = Array.isArray(result) ? result : [result];
        lines.slice().reverse().forEach(printLine);
    }

    // newest line goes at the top of the DOM (see column-reverse in CSS),
    // so each new line visually appears directly above the input row
    function printLine(text) {
        const line = document.createElement('div');
        line.className = 'dev-console-line';
        line.textContent = text;
        outputEl.insertBefore(line, outputEl.firstChild);
    }

    function clearOutput() {
        outputEl.textContent = '';
    }

    function openDevConsole() {
        if (!consoleEl) {
            const built = buildConsole();
            consoleEl = built.el;
            outputEl = built.output;
            inputEl = built.input;
        }

        // Guard against a font-loading race: if JetBrains Mono (or whichever
        // fallback ends up used) hasn't finished loading/parsing yet, typed
        // glyphs can paint blank (correct monospace advance width reserved,
        // but no ink) until the font resolves mid-typing. document.fonts.ready
        // resolves once the page's already-triggered font loads have settled,
        // so waiting on it before revealing/focusing the console means the
        // font is guaranteed ready by the time the user can type into it -
        // this closes the race instead of hoping it doesn't happen.
        // document.fonts is undefined in very old browsers - fall back to
        // opening immediately rather than breaking the console for them.
        const ready = window.document.fonts ? window.document.fonts.ready : Promise.resolve();

        ready.then(() => {
            consoleEl.classList.add('visible');
            // focus on next frame - immediately after adding the class can lose
            // to the transition/layout pass in some browsers
            requestAnimationFrame(() => inputEl.focus());
        });
    }

    function closeDevConsole() {
        if (consoleEl) consoleEl.classList.remove('visible');
        pendingConfirmation = null; // don't let a stale confirmation leak into the next session
    }

    window.openDevConsole = openDevConsole;
    window.closeDevConsole = closeDevConsole;
})();