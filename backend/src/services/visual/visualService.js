const BLACK = '#000000';
const WHITE = '#FFFFFF';
const GOLD = '#D4AF37';

const VIEWBOX = '0 0 600 300';
const MAX_NODES = 6;
const MAX_COLUMNS = 3;
const MAX_BULLETS = 5;
const BULLET_MAX_CHARS = 40;

const NONE = { type: 'none', fallback: true };

/**
 * Labels ultimately originate from an LLM response, so everything interpolated
 * into the SVG string must be escaped.
 */
function escapeXml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function truncate(value, max) {
    const text = String(value == null ? '' : value).trim();
    if (text.length <= max) return text;
    return `${text.slice(0, max - 1)}…`;
}

function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

function wrapSvg(body) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX}" width="100%" role="img">`
        + `<rect x="0" y="0" width="600" height="300" fill="${WHITE}"/>`
        + body
        + '</svg>';
}

function titleElement(title) {
    if (!isNonEmptyString(title)) return '';
    return `<text x="300" y="34" text-anchor="middle" font-family="Georgia, serif" font-size="18" fill="${BLACK}">`
        + `${escapeXml(truncate(title, 60))}</text>`;
}

function box(x, y, width, height, label, fontSize = 12) {
    const lines = splitLabel(label, Math.floor(width / (fontSize * 0.55)));
    const startY = y + height / 2 - ((lines.length - 1) * (fontSize + 3)) / 2 + fontSize / 3;
    const text = lines
        .map((line, index) =>
            `<text x="${x + width / 2}" y="${startY + index * (fontSize + 3)}" text-anchor="middle" `
            + `font-family="Helvetica, Arial, sans-serif" font-size="${fontSize}" fill="${BLACK}">`
            + `${escapeXml(line)}</text>`)
        .join('');

    return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="4" fill="${WHITE}" `
        + `stroke="${GOLD}" stroke-width="2"/>${text}`;
}

function splitLabel(label, charsPerLine) {
    const words = truncate(label, 48).split(/\s+/).filter(Boolean);
    const lines = [];
    let current = '';

    for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (candidate.length > charsPerLine && current) {
            lines.push(current);
            current = word;
        } else {
            current = candidate;
        }
        if (lines.length === 2) break;
    }
    if (current && lines.length < 3) lines.push(current);

    return lines.length ? lines.slice(0, 3) : [''];
}

function arrowDefs() {
    return `<defs><marker id="cb-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" `
        + `orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${BLACK}"/></marker></defs>`;
}

function normalizeNodes(spec) {
    if (!Array.isArray(spec.nodes)) return null;
    const nodes = spec.nodes.filter(node => node && isNonEmptyString(node.label));
    if (nodes.length === 0 || nodes.length > MAX_NODES) return null;
    return nodes;
}

function buildProcess(spec) {
    const nodes = normalizeNodes(spec);
    if (!nodes) return NONE;

    const ordered = orderByEdges(nodes, spec.edges);
    const count = ordered.length;
    const gap = 16;
    const margin = 24;
    const width = (600 - margin * 2 - gap * (count - 1)) / count;
    const height = 100;
    const y = 120;

    let body = arrowDefs() + titleElement(spec.title);

    ordered.forEach((node, index) => {
        const x = margin + index * (width + gap);
        body += box(x, y, width, height, node.label);
        if (index > 0) {
            body += `<line x1="${x - gap}" y1="${y + height / 2}" x2="${x - 3}" y2="${y + height / 2}" `
                + `stroke="${BLACK}" stroke-width="2" marker-end="url(#cb-arrow)"/>`;
        }
    });

    return { type: 'process', svg: wrapSvg(body) };
}

/**
 * Uses edge order to sequence the nodes when the edges form a usable chain,
 * otherwise keeps the order the model emitted.
 */
function orderByEdges(nodes, edges) {
    if (!Array.isArray(edges) || edges.length === 0) return nodes;

    const byId = new Map(nodes.map(node => [node.id, node]));
    const targets = new Set(edges.map(edge => edge && edge.to).filter(Boolean));
    const start = nodes.find(node => !targets.has(node.id));
    if (!start) return nodes;

    const nextOf = new Map();
    for (const edge of edges) {
        if (edge && edge.from && edge.to && !nextOf.has(edge.from)) {
            nextOf.set(edge.from, edge.to);
        }
    }

    const ordered = [];
    const seen = new Set();
    let current = start;
    while (current && !seen.has(current.id)) {
        ordered.push(current);
        seen.add(current.id);
        current = byId.get(nextOf.get(current.id));
    }

    return ordered.length === nodes.length ? ordered : nodes;
}

function buildHierarchy(spec) {
    const nodes = normalizeNodes(spec);
    if (!nodes || nodes.length < 2) return NONE;

    const [parent, ...children] = nodes;
    const count = children.length;
    const gap = 14;
    const margin = 24;
    const childWidth = (600 - margin * 2 - gap * (count - 1)) / count;
    const childHeight = 80;
    const childY = 190;
    const parentWidth = Math.min(240, 600 - margin * 2);
    const parentX = (600 - parentWidth) / 2;
    const parentY = 60;
    const parentHeight = 60;

    let body = titleElement(spec.title);
    body += box(parentX, parentY, parentWidth, parentHeight, parent.label, 13);

    children.forEach((child, index) => {
        const x = margin + index * (childWidth + gap);
        body += `<line x1="300" y1="${parentY + parentHeight}" x2="${x + childWidth / 2}" y2="${childY}" `
            + `stroke="${BLACK}" stroke-width="1.5"/>`;
        body += box(x, childY, childWidth, childHeight, child.label);
    });

    return { type: 'hierarchy', svg: wrapSvg(body) };
}

function buildComparison(spec) {
    if (!Array.isArray(spec.items)) return NONE;

    const items = spec.items.filter(item =>
        item && isNonEmptyString(item.label) && Array.isArray(item.points));
    if (items.length < 2 || items.length > MAX_COLUMNS) return NONE;

    const count = items.length;
    const gap = 16;
    const margin = 24;
    const width = (600 - margin * 2 - gap * (count - 1)) / count;
    const top = 56;
    const height = 220;

    let body = titleElement(spec.title);

    items.forEach((item, index) => {
        const x = margin + index * (width + gap);
        body += `<rect x="${x}" y="${top}" width="${width}" height="${height}" rx="4" fill="${WHITE}" `
            + `stroke="${GOLD}" stroke-width="2"/>`;
        body += `<line x1="${x}" y1="${top + 34}" x2="${x + width}" y2="${top + 34}" `
            + `stroke="${GOLD}" stroke-width="1"/>`;
        body += `<text x="${x + width / 2}" y="${top + 23}" text-anchor="middle" `
            + `font-family="Georgia, serif" font-size="14" fill="${BLACK}">`
            + `${escapeXml(truncate(item.label, 28))}</text>`;

        item.points
            .filter(isNonEmptyString)
            .slice(0, MAX_BULLETS)
            .forEach((point, pointIndex) => {
                const y = top + 60 + pointIndex * 32;
                body += `<circle cx="${x + 14}" cy="${y - 4}" r="3" fill="${GOLD}"/>`;
                body += `<text x="${x + 26}" y="${y}" font-family="Helvetica, Arial, sans-serif" `
                    + `font-size="11" fill="${BLACK}">`
                    + `${escapeXml(truncate(point, BULLET_MAX_CHARS))}</text>`;
            });
    });

    return { type: 'comparison', svg: wrapSvg(body) };
}

const BUILDERS = {
    process: buildProcess,
    hierarchy: buildHierarchy,
    comparison: buildComparison
};

class VisualService {
    /**
     * Builds a deterministic SVG diagram from an AI-produced visual spec.
     * @param {Object} visualSpec
     * @returns {{type: string, svg: string}|{type: 'none', fallback: true}}
     */
    generate(visualSpec) {
        if (!visualSpec || typeof visualSpec !== 'object') return NONE;

        const builder = BUILDERS[visualSpec.type];
        if (!builder) return NONE;

        try {
            return builder(visualSpec);
        } catch (error) {
            console.warn('VisualService: failed to build diagram:', error.message);
            return NONE;
        }
    }
}

export default new VisualService();
