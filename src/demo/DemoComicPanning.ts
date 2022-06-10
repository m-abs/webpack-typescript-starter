import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';

@customElement("demo-comic-panning")
export class DemoComicPanning extends LitElement {
    @property()
    public books = ['comic-panning', 'xkcd'];

    @property()
    public selectedBook?: string;

    private get canGoBack() {
        return this.navIdx > 0;
    }

    private get canGoForward() {
        return (this.navIdx + 1) < this.navLength;
    }

    private get navLength() {
        return this.mediaOverlay?.narration?.[0]?.narration?.length ?? 0;
    }

    private get narrationItem(): MediaOverlayNarrationNode {
        return this.mediaOverlay?.narration?.[0]?.narration[this.navIdx];
    }

    @query('#iframe-content-viewer')
    iframe?: HTMLIFrameElement;

    @property()
    public mediaOverlay?: MediaOverlay;

    @property()
    public navIdx = 0;

    private buttonControlClasses(enabled: boolean) {
        return classMap({
            disabled: !enabled,
        });
    }

    protected renderBook() {
        if (!this.selectedBook) {
            return nothing;
        }

        return html`<iframe id="iframe-content-viewer" @load="${this.iframeLoaded}" src="/books/${this.selectedBook}/index.html"></iframe>`;
    }

    protected renderControlButton(click: (e: Event) => void, isEnabled: boolean, label: string) {
        return html`
           <button @click="${click}" class="${this.buttonControlClasses(isEnabled)}" ?disabled="${!isEnabled}">${label}</button>
        `;
    }

    protected renderControls() {
        if (!this.selectedBook) {
            return nothing;
        }

        return html`
            <div class="book-controls">
                ${this.renderControlButton(this.prevSegmentEvent, this.canGoBack, "PREV")}
                <div>${this.navIdx}</div>
                ${this.renderControlButton(this.nextSegmentEvent, this.canGoForward, "NEXT")}
            </div>
        `;
    }

    protected render() {
        return html`
            <header class="book-selector">
                ${this.books.map((book) => html`<button data-book="${book}" @click="${this.selectBookEvent}">${book}</button>`)}
            </header>

            ${this.renderControls()}

            <section class="content-viewer">
                ${this.renderBook()}
            </section>

            <footer>DEMO</footer>
        `;
    }

    private prevSegmentEvent() {
        if (this.navIdx > 0) {
            this.navIdx -= 1;
        }

        this.updateNarration();
    }

    private nextSegmentEvent() {
        this.navIdx = Math.min(this.navLength - 1, this.navIdx + 1);

        this.updateNarration();
    }

    private updateNarration() {
        const item = this.narrationItem;
        const iframe = this.iframe;

        if (item && iframe) {
            const { audio, text } = item;
            const audioUrl = new URL(`/books/${this.selectedBook}/${audio.replace("#", "?")}`, window.location.href);
            const textUrl = new URL(`/books/${this.selectedBook}/${text}`, window.location.href);

            const duration = audioUrl.searchParams.get("t").split(",").map((p) => parseFloat(p)).reverse().reduce((p, v) => p + v, 0);

            iframe.contentWindow.SetActiveFrame(textUrl.hash, duration * 1000);
        }

        this.requestUpdate();
    }

    private async selectBookEvent(e: MouseEvent) {
        this.selectedBook = (e.target as HTMLButtonElement).dataset.book;

        this.mediaOverlay = await fetch(`/books/${this.selectedBook}/media-overlay.json`)
            .then((r) => r.json())
            .then((j) => j as MediaOverlay);

        this.navIdx = 0;

        this.requestUpdate();
    }

    private iframeLoaded(e: Event) {
        const iframe = e.target as HTMLIFrameElement;

        const script = iframe.contentDocument.createElement("script");
        script.async = false;
        script.src = `/comic.bundle.js?r=${Date.now()}`;
        script.onload = () => this.updateNarration();
        iframe.contentDocument.head.appendChild(script);

        const link = iframe.contentDocument.createElement("link");
        // <link href="main.bundle.css" rel="stylesheet">

        link.href = `/comic.bundle.css?r=${Date.now()}`;
        link.type = "text/css";
        link.rel = "stylesheet";
        iframe.contentDocument.head.appendChild(link);
    }

    // Define scoped styles right with your component, in plain CSS
    static styles = css`
        :host {
            display: flex;
            flex-direction: column;
            height: 100vh;
        }
        
        :host .book-selector,
        :host .book-controls {
            display: flex;
            flex-direction: row;
            background-color: blue;
            height: 50px;
        }
        
        :host button {
            cursor: pointer;
        }
        
        :host button[disabled],
        :host button.disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        :host .content-viewer,
        :host .placeholder {
            flex-grow: 1;
            flex-shrink: 0;
        }

        :host .content-viewer iframe {
            border: 0;
            padding: 0;
            margin: 0 auto;
            height: 100%;
            width: 100vw;
        }
        
        :host footer {
            background-color: yellow;
            display: block;
            text-align: center;
            justify-content: flex-end;
        }
    `;
}

export interface MediaOverlay {
    role: string;
    narration: MediaOverlayNarration[];
}

export interface MediaOverlayNarration {
    narration: MediaOverlayNarrationNode[];
}

export interface MediaOverlayNarrationNode {
    text: string;
    audio: string;
}
