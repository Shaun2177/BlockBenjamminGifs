/**
 * @name BlockBenjamminGifs
 * @description Hides GIFs whose URLs contain any word from your blocked list, replacing them with an embed.
 * @version 1.1.0
 * @author Shaun2177
 * @authorLink https://github.com/Shaun2177
 * @source https://github.com/Shaun2177/BlockBenjamminGifs
*/

// Add more words to this array to block additional GIFs
const BLOCKED_WORDS = [
	"benjammin",
];

// GIF sources matched against src/href URLs
const GIF_PATTERNS = [
	".gif",
	"tenor.com",
	"giphy.com",
	"media.discordapp.net",
	"media.tenor.com",
	"i.imgur.com",
];

const config = {
	changelog: [],
	settings: [
		{
			type: "switch",
			id: "blockInPicker",
			name: "Block GIFs in GIF Picker",
			note: "If enabled, blocked GIFs will also be hidden in the GIF picker/search tab.",
			value: true,
		},
		{
			type: "switch",
			id: "caseSensitive",
			name: "Case Sensitive Matching",
			note: "If enabled, 'Benjammin' and 'benjammin' are treated as different words.",
			value: false,
		},
	],
};

function getSetting(key) {
	return config.settings.reduce(
		(found, s) => found ?? (s.id === key ? s : s.settings?.find(x => x.id === key)),
		undefined
	);
}

const { Data, DOM, UI } = BdApi;

module.exports = class BlockGifs {
	constructor(meta) {
		this.meta = meta;
		this.observer = null;

		this.settings = new Proxy({}, {
			get: (_t, key) => Data.load(this.meta.name, key) ?? getSetting(key)?.value,
			set: (_t, key, value) => {
				Data.save(this.meta.name, key, value);
				getSetting(key).value = value;
				return true;
			},
		});
	}

	initSettings(settings = config.settings) {
		settings.forEach(s => {
			if (s.settings) this.initSettings(s.settings);
			else if (s.id) this.settings[s.id] = Data.load(this.meta.name, s.id) ?? s.value;
		});
	}

	getSettingsPanel() {
		return UI.buildSettingsPanel({
			settings: config.settings,
			onChange: (_cat, id, value) => {
				this.settings[id] = value;
				this.rescan();
			},
		});
	}

	// Detection

	isGifUrl(url) {
		if (!url) return false;
		const lower = url.toLowerCase();
		return GIF_PATTERNS.some(p => lower.includes(p));
	}

	isBlocked(url) {
		if (!url) return false;
		const haystack = this.settings.caseSensitive ? url : url.toLowerCase();
		return BLOCKED_WORDS.some(word => {
			const needle = this.settings.caseSensitive ? word : word.toLowerCase();
			return haystack.includes(needle);
		});
	}

	isInGifPicker(el) {
		return !!(
			el.closest?.('[class*="results__"]') ||
			el.closest?.('[class*="gifPicker"]') ||
			el.closest?.('[class*="categoryList"]')
		);
	}

	getOwnerNode(el, inPicker) {
		if (inPicker) {
			return el.closest?.('[class*="result__"]') ?? el.parentElement;
		}
		return (
			el.closest?.('[class*="imageWrapper"]') ??
			el.closest?.('[class*="embedWrapper"]') ??
			el.closest?.('article') ??
			el.closest?.('[id^="message-accessories"]') ??
			el.parentElement
		);
	}

	// DOM processing

	processContainer(container) {
		if (!(container instanceof HTMLElement)) return;

		const seen = new Set();
		if (container.matches?.("img, video, a[href]")) seen.add(container);
		container.querySelectorAll("img, video, a[href]").forEach(el => seen.add(el));

		seen.forEach(el => this.processElement(el));
	}

	processElement(el) {
		if (el.dataset.btgDone) return;

		const urls = [...new Set(
			[
				el.src,
				el.currentSrc,
				el.href,
				el.getAttribute("data-original-src"),
				el.closest?.("a")?.href,
			].filter(Boolean)
		)];

		if (!urls.some(u => this.isGifUrl(u))) return;
		if (!urls.some(u => this.isBlocked(u))) return;

		const inPicker = this.isInGifPicker(el);

		if (inPicker && !this.settings.blockInPicker) return;

		el.dataset.btgDone = "1";

		const owner = this.getOwnerNode(el, inPicker);
		if (owner?.dataset.btgOwnerDone) {
			if (inPicker) {
				el.style.display = "none";
			} else {
				const w = el.closest?.('[class*="imageWrapper"], [class*="embedMedia"]') ?? el;
				w.style.display = "none";
			}
			return;
		}
		if (owner) owner.dataset.btgOwnerDone = "1";

		this.hideAndEmbed(el, inPicker, owner);
	}

	hideAndEmbed(el, inPicker, owner) {
		const wrapper = inPicker
			? el
			: (el.closest?.('[class*="imageWrapper"], [class*="embedMedia"]') ?? el);

		const insertTarget = inPicker
			? (owner ?? el.parentElement)
			: (wrapper.closest?.('[id^="message-accessories"]') ?? wrapper.parentElement);

		wrapper.style.display = "none";

		if (inPicker && owner) {
			owner.dataset.btgClickBlocked = "1";
			owner.style.pointerEvents = "none";
		}

		const container = document.createElement("div");
		container.dataset.btgEmbed = "1";
		if (inPicker) container.classList.add("btg-compact");

		if (inPicker) {
			container.innerHTML = `
				<div class="btg-embed">
					<div class="btg-row">
						<svg width="22" height="22" viewBox="0 0 24 24" fill="none" style="flex-shrink:0">
							<path d="M12 2L4 5v6c0 5.25 3.5 10.15 8 11.35C16.5 21.15 20 16.25 20 11V5L12 2z" fill="var(--status-danger)"/>
							<path d="M9 12l2 2 4-4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
						</svg>
						<div>
							<div class="btg-title">Blocked GIF</div>
							<div class="btg-desc">May contain a Benjammins GIF</div>
						</div>
					</div>
					<div class="btg-footer">
						<span class="btg-toggle">👁 Show</span>
					</div>
				</div>
			`;
		} else {
			container.innerHTML = `
				<div class="btg-embed">
					<div class="btg-row">
						<svg width="22" height="22" viewBox="0 0 24 24" fill="none" style="flex-shrink:0">
							<path d="M12 2L4 5v6c0 5.25 3.5 10.15 8 11.35C16.5 21.15 20 16.25 20 11V5L12 2z" fill="var(--status-danger)"/>
							<path d="M9 12l2 2 4-4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
						</svg>
						<div>
							<div class="btg-title">Blocked GIF</div>
							<div class="btg-desc">This message contains media which may contain an edited Benjammins GIF</div>
						</div>
					</div>
				</div>
				<div class="btg-footer">
					<span class="btg-toggle">👁 Show original GIF</span>
				</div>
			`;
		}

		container.querySelector(".btg-toggle").addEventListener("click", e => {
			e.stopPropagation();
			wrapper.style.display = "";
			wrapper.querySelectorAll("[data-btg-done]").forEach(child => {
				child.style.display = "";
			});
			if (owner) delete owner.dataset.btgOwnerDone;
			container.remove();
			if (inPicker && owner) {
				owner.style.pointerEvents = "";
				delete owner.dataset.btgClickBlocked;
			}
		});

		if (inPicker) {
			for (const evt of ["mouseover", "mouseenter", "mousemove", "mouseout", "mouseleave"]) {
				container.addEventListener(evt, e => e.stopPropagation());
			}
		}

		insertTarget.appendChild(container);
	}

	// Helpers

	rescan() {
		document.querySelectorAll("[data-btg-embed]").forEach(e => e.remove());
		document.querySelectorAll("[data-btg-done]").forEach(el => {
			el.style.display = "";
			delete el.dataset.btgDone;
			const wrapper = el.closest?.('[class*="imageWrapper"], [class*="gifFavorite"], [class*="embedMedia"]');
			if (wrapper) wrapper.style.display = "";
		});
		document.querySelectorAll("[data-btg-owner-done]").forEach(el => {
			delete el.dataset.btgOwnerDone;
		});
		document.querySelectorAll("[data-btg-click-blocked]").forEach(el => {
			el.style.pointerEvents = "";
			delete el.dataset.btgClickBlocked;
		});
		this.processContainer(document.body);
	}

	// Lifecycle

	start() {
		this.initSettings();

		DOM.addStyle(this.meta.name, `
            /* ── Standard chat embed ── */
            .btg-embed {
                display:        flex;
                flex-direction: column;
                background:     var(--background-secondary);
                border:         1px solid var(--status-danger);
                border-left:    4px solid var(--status-danger);
                border-radius:  4px;
                white-space:    nowrap;
                width:          max-content;
                margin-top:     2px;
            }
            .btg-row {
                display:     flex;
                align-items: center;
                gap:         12px;
                padding:     12px 16px;
            }
            .btg-title {
                font-size:      12px;
                font-weight:    700;
                color:          var(--status-danger);
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .btg-desc {
                font-size:  14px;
                color:      var(--text-muted);
                margin-top: 3px;
            }
            .btg-footer {
                display:    block;
                margin-top: 5px;
            }
            .btg-toggle {
                font-size:   13px;
                color:       var(--text-muted);
                cursor:      pointer;
                user-select: none;
            }
            .btg-toggle:hover {
                color:           var(--text-normal);
                text-decoration: underline;
            }

            /* ── Compact GIF picker embed ── */
            .btg-compact {
                position:       absolute;
                inset:          0;
                z-index:        1;
                box-sizing:     border-box;
                pointer-events: none;
            }
            .btg-compact .btg-toggle {
                pointer-events: auto;
            }
            .btg-compact .btg-embed {
                display:         flex;
                flex-direction:  column;
                justify-content: space-between;
                width:           100%;
                height:          100%;
                box-sizing:      border-box;
                white-space:     normal;
                margin-top:      0;
                border-radius:   4px;
            }
            .btg-compact .btg-row {
                flex:        1;
                display:     flex;
                align-items: center;
                padding:     10px 12px;
                gap:         10px;
                flex-wrap:   wrap;
                overflow:    hidden;
            }
            .btg-compact .btg-row svg {
                width:       20px;
                height:      20px;
                flex-shrink: 0;
            }
            .btg-compact .btg-title {
                font-size: 13px;
            }
            .btg-compact .btg-desc {
                font-size:   13px;
                white-space: normal;
                word-break:  break-word;
            }
            .btg-compact .btg-footer {
                flex-shrink: 0;
                padding:     8px 12px;
                border-top:  1px solid var(--background-modifier-accent);
            }
            .btg-compact .btg-toggle {
                font-size: 15px;
            }
        `);

		this.processContainer(document.body);

		this.observer = new MutationObserver(mutations => {
			for (const { addedNodes } of mutations) {
				for (const node of addedNodes) {
					if (node instanceof HTMLElement) this.processContainer(node);
				}
			}
		});

		this.observer.observe(document.body, { childList: true, subtree: true });
	}

	stop() {
		this.observer?.disconnect();
		this.observer = null;
		document.querySelectorAll("[data-btg-embed]").forEach(e => e.remove());
		document.querySelectorAll("[data-btg-done]").forEach(el => {
			el.style.display = "";
			delete el.dataset.btgDone;
			const wrapper = el.closest?.('[class*="imageWrapper"], [class*="gifFavorite"], [class*="embedMedia"]');
			if (wrapper) wrapper.style.display = "";
		});
		document.querySelectorAll("[data-btg-owner-done]").forEach(el => {
			delete el.dataset.btgOwnerDone;
		});
		document.querySelectorAll("[data-btg-click-blocked]").forEach(el => {
			el.style.pointerEvents = "";
			delete el.dataset.btgClickBlocked;
		});
		DOM.removeStyle(this.meta.name);
	}
};
