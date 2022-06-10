import animejs, { AnimeAnimParams, AnimeInstance } from "animejs";
import { CanvasSize, ComicFrame } from "types";
import './ComicBookPage.scss';

// At which factor should we pane over a frame?
const panningFactor = 1.75;
const focusDuration = 750;
const MAX_ZOOM_VALUE = 3;
const framePadding = 10;

interface ComicFramePosition {
    width: number;
    height: number;
    topLeft: {
        x: number;
        y: number;
    };
    bottomRight: {
        x: number;
        y: number;
    };
}

export class ComicBookPage {
    constructor(w: Window) {
        this._window = w;

        this._header = this.document.querySelector("body > :is(h1, h2, h3, h4, h5)");
        this._comicImg = this.document.querySelector("body > img");
        const section = this._container = this.document.createElement("section");
        section.classList.add("page");
        this._comicImg.parentElement.insertBefore(section, this._comicImg);
        section.appendChild(this._comicImg);

        this._canvasSize = this.extractCanvasSize();

        Object.entries(this.calcFramePositionAndSize(this.makeFramePosition(this.ensureComicFrame())))
            .forEach(([key, value]) => {
                this._comicImg.style.setProperty(key, `${value}px`);
            });

        this._window.addEventListener("resize", this.onResize);
    }

    protected readonly _window: Window;

    protected animeInstance: AnimeInstance | void;

    protected get document() {
        return this._window.document;
    }

    protected readonly _container: HTMLElement;

    protected get clientWidth() {
        return this._container.clientWidth
    }

    protected get clientHeight() {
        return this._container.clientHeight;
    }

    protected readonly _header: HTMLHeadingElement;
    protected readonly _comicImg: HTMLImageElement;

    protected _areas: Map<string, ComicFrame> | undefined;
    public get comicAreas(): Map<string, ComicFrame> {
        if (!this._areas) {
            this._areas = new Map<string, ComicFrame>();
            const canvasFrame = this.ensureComicFrame();
            this._areas.set(this._comicImg.id, canvasFrame);
            this._areas.set(`#${this._comicImg.id}`, canvasFrame);

            for (const area of this.document.querySelectorAll("body > div")) {
                if (area instanceof HTMLDivElement) {
                    const frame = this.extractComicFrame(area);
                    this._areas.set(area.id, frame);
                    this._areas.set(`#${area.id}`, frame);
                }
            }
        }

        return this._areas;
    }

    protected _currentFrame: ComicFrame;

    protected readonly _canvasSize: CanvasSize;

    protected _duration: number;

    /**
     * Ensure ComicFrame for both full page segments and comic book frame segments.
     */
    protected ensureComicFrame(frame?: ComicFrame): ComicFrame {
        if (!frame) {
            // No frame, this is a full page segment generate a ComicFrame for the whole page.
            return {
                ...this._canvasSize,
                left: 0,
                top: 0,
            };
        }

        return frame;
    }

    /**
     * Render the comic book frame
     */
    protected renderCurrentComicFrame() {
        const cls = `${this.cls}.frameUpdated() - ${JSON.stringify(this._currentFrame)}, ${JSON.stringify(this._canvasSize)}, ${this._duration})`;
        if (this._canvasSize == undefined || this._currentFrame == undefined || this._duration == undefined) {
            return;
        }

        // Remove old animation
        animejs.remove(this._comicImg);

        const framePosition = this.makeFramePosition(this._currentFrame);

        const keyframes: AnimeAnimParams[] = [
            {
                ...this.calcFramePositionAndSize(framePosition),
                duration: focusDuration,
                opacity: 1, // fixes odd jump at first render of the new image.
            },
        ];

        let panFramePosition: ComicFramePosition;
        let finalFramePosition: ComicFramePosition;

        if (this.shouldDoVerticalPanning(framePosition)) {
            // Vertical pan from top to bottom
            const topHalfFrame = {
                ...this._currentFrame,
                height: this._currentFrame.width,
            };

            // Step 1.: Move to the top of the frame.
            panFramePosition = this.makeFramePosition(topHalfFrame);

            // Step 2.: Pan downwards from the top of the frame to the bottom of the frame.
            // This means the top/left y coordinate end up being is frame's height - width;
            finalFramePosition = this.makeFramePosition(topHalfFrame);
            finalFramePosition.topLeft.y += this._currentFrame.height - this._currentFrame.width + framePadding;

            this.debug(`${cls} - vertical panning from start: ${JSON.stringify(panFramePosition)} to tl.y: ${finalFramePosition.topLeft.y}`);
        } else if (this.shouldDoHorizontalPanning(framePosition)) {
            // Horizontal pan from left to right

            const leftHalfFrame = {
                ...this._currentFrame,
                width: this._currentFrame.height,
            };

            // Step 1. Move to the left side of the frame.
            panFramePosition = this.makeFramePosition(leftHalfFrame);

            // Step 2. Pan leftwards from the left of the frame to the right side of the frame.
            // This means top/left x coordinate end up being frame's width - height.
            finalFramePosition = this.makeFramePosition(leftHalfFrame);
            finalFramePosition.topLeft.x += this._currentFrame.width - this._currentFrame.height + framePadding;

            this.debug(`${cls} - horizontal panning from start: ${JSON.stringify(panFramePosition)} to tl.x: ${finalFramePosition.topLeft.x}`);
        }

        if (panFramePosition && finalFramePosition) {
            keyframes.push(
                {
                    ...this.calcFramePositionAndSize(panFramePosition),
                    duration: focusDuration,
                },
                {
                    ...this.calcFramePositionAndSize(finalFramePosition),
                    // duration here is segment duration minus the 2x focusDuration from the first two steps of animation
                    duration: this._duration ?? 0 - 2 * focusDuration,
                },
            );
        }

        this.animeInstance = animejs({
            targets: this._comicImg,
            keyframes,
            easing: 'cubicBezier(0.455, 0.030, 0.515, 0.955)',
        });
    }

    /**
     * Should we do vertical panning?
     *
     * Vertical panning is needed if the ratio between frame's height and width is larger than panningFactor.
     * AND
     * The frame's height is larger than the containers height * panningFactor
     */
    protected shouldDoVerticalPanning(framePosition: ComicFramePosition) {
        return framePosition.height / framePosition.width >= panningFactor && framePosition.height > this.clientHeight * panningFactor;
    }

    /**
     * Should we do horizontal panning?
     *
     * Horizontal panning is needed if the ratio between frame's width and height is larger than panningFactor.
     * AND
     * The frame's width is larger than the containers width * panningFactor
     */
    protected shouldDoHorizontalPanning(framePosition: ComicFramePosition) {
        return framePosition.width / framePosition.height >= panningFactor && framePosition.width > this.clientWidth * panningFactor;
    }

    /**
     * Convert a ComicFrame to a ComicFramePosition.
     */
    protected makeFramePosition({ left: x, top: y, width, height }: ComicFrame): ComicFramePosition {
        return {
            width,
            height,
            topLeft: {
                x,
                y,
            },
            bottomRight: {
                x: x + width,
                y: y + height,
            },
        };
    }

    /**
     * Calculate the position and sizing info needed to show a frame within
     * the container element.
     *
     * If the frame too large to fit within the container, the image will be resized.
     */
    protected calcFramePositionAndSize(frame: ComicFramePosition): ComicFrame {
        // Start by getting width and height of the container minus the padding.
        const clientWidth = this.clientWidth - framePadding * 2;
        const clientHeight = this.clientHeight - framePadding * 2;

        // Get image size info.
        const { width: imageWidth, height: imageHeight } = this._canvasSize;

        // Destruct the framing info into size and top/left-coordinates.
        const {
            width: frameWidth,
            height: frameHeight,
            topLeft: { x: frameX0, y: frameY0 },
        } = frame;

        /*
         * Scale factor for the frame to fit into the container
         *
         * If the frame is bigger than the container, the comic book page must be scaled down.
         * The image will max be scaled up to value of MAX_ZOOM_VALUE
         */
        const scale = Math.min(MAX_ZOOM_VALUE, clientWidth / frameWidth, clientHeight / frameHeight);

        this.debug(
            `ComicViewerComponent.calcFramePositionAndSize() -> scale: ${scale} -> ${MAX_ZOOM_VALUE} -> ${clientWidth / frameWidth} -> ${clientHeight / frameHeight}`,
        );

        // Resize the image if needed
        const scaledImageWidth = imageWidth * scale;
        const scaledImageHeight = imageHeight * scale;

        // Scaled top/left coordinates are a result of the original coordinate * scale.
        const scaledFrameX0 = -(frameX0 * scale);
        const scaledFrameY0 = -(frameY0 * scale);

        // The frame needs to be centered, if the scaled frame size is smaller than the container size.
        const scaledFrameWidth = frameWidth * scale;

        let xCentering = 0;
        let yCentering = 0;

        if (scaledFrameWidth < clientWidth) {
            xCentering = (clientWidth - scaledFrameWidth) / 2;
        }

        const scaledFrameHeight = frameHeight * scale;
        if (scaledFrameHeight < clientHeight) {
            yCentering = (clientHeight - scaledFrameHeight) / 2;
        }

        return {
            top: yCentering + scaledFrameY0 + framePadding,
            left: xCentering + scaledFrameX0 + framePadding,
            width: scaledImageWidth,
            height: scaledImageHeight,
        };
    }

    /**
     * Set current comic frame from id and duration
     */
    public SetCurrentFrame(id: string, duration: number): void {
        if (this.comicAreas.has(id.toLocaleLowerCase())) {
            this._currentFrame = this.comicAreas.get(id.toLocaleLowerCase());
            this._duration = duration;

            this.renderCurrentComicFrame();
        }
    }

    /**
     * Helps us get the name of the class
     */
    protected readonly componentName = this.constructor.name;

    protected static _instance = 0;

    protected _instance: number;

    protected get instance(): number {
        return this._instance ?? (this._instance = ++ComicBookPage._instance);
    }

    protected get cls(): string {
        const cls = `${this.componentName}<${this.instance}>`;
        return cls;
    }

    public log(message: string, ...data: unknown[]): void {
        this.emitLog('log', message, ...data);
    }

    public error(message: string, ...data: unknown[]): void {
        this.emitLog('error', message, ...data);
    }

    public debug(message: string, ...data: unknown[]): void {
        this.emitLog('debug', message, ...data);
    }

    protected emitLog(type: 'log' | 'debug' | 'error', message: string, ...data: unknown[]): void {
        console[type]?.(message, ...data);
    }

    protected extractComicFrame(area: HTMLDivElement): ComicFrame {
        const frame: ComicFrame = {
            height: 0,
            width: 0,
            left: 0,
            top: 0,
        };

        for (const key of ["height", "width", "left", "top"]) {
            const value = area.style.getPropertyValue(key);
            if (!value) {
                console.error("{0} is missing style[{1}]", area.id, key);
                continue;
            }

            (frame as unknown as Record<string, number>)[key] = parseInt(value.replace(/px$/, ''), 10);
        }

        return frame;
    }

    protected extractCanvasSize(): CanvasSize {
        if (this._comicImg.dataset["CanvasSize"]) {
            return JSON.parse(this._comicImg.dataset["CanvasSize"]) as CanvasSize;
        }

        const frame: CanvasSize = {
            height: 0,
            width: 0,
        };

        for (const key of ["height", "width"]) {
            const value = this._comicImg.style.getPropertyValue(key);
            if (!value) {
                console.error("{0} is missing style[{1}]", this._comicImg.id, key);
                continue;
            }

            (frame as unknown as Record<string, number>)[key] = parseInt(value.replace(/px$/, ''), 10);
        }

        this._comicImg.dataset["CanvasSize"] = JSON.stringify(frame);

        return frame;
    }

    protected readonly onResize = () => {
        this.renderCurrentComicFrame();
    }
}


declare global {
    interface Window {
        comicBookPage: ComicBookPage;
        SetActiveFrame: (id: string, duration: number) => void;
    }
}

function Setup() {
    if (window.comicBookPage) {
        return;
    }

    document.removeEventListener("DOMContentLoaded", Setup);
    window.comicBookPage = new ComicBookPage(window);
}

window.SetActiveFrame = (id: string, duration: number) => {
    window.comicBookPage?.SetCurrentFrame(id, duration);

    document.querySelectorAll(".active").forEach((e) => e.classList.remove("active"));
    document.querySelector(`#${id.replace("#", "")}`)?.classList.add("active");
};

if (document.readyState !== "loading") {
    window.setTimeout(Setup);
} else {
    document.addEventListener("DOMContentLoaded", Setup);
}