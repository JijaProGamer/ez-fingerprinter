if (!window.crypto) {
    throw new Error("Web Crypto API is not available in this browser.")
}

let EZFingerprinter = {}
let configurations = {
    video: [`mp4; codecs="avc1.640028"`, `mp4; codecs="flac"`,
        `ogg; codecs="theora"`,
        `webm; codecs="vp9"`, `mp4; codecs="hvc1"`,
        `webm; codecs="vp8"`, `mp4; codecs="av01"`, "x-mpeg1", "x-mpeg2"
    ],
    audio: ["mp3", "aac", "ogg; codecs=vorbis", "flac", "wav", "opus", "ac3", "mpeg"]
}

let to = (promise) => {
    return new Promise((resolve, reject) => {
        promise.then(function () {
            resolve([true, ...arguments])
        }).catch(function () {
            resolve([false, ...arguments])
        })
    })
}

const CookieManager = {
    addCookie: (name, value, daysToExpire) => {
        const date = new Date();
        date.setTime(date.getTime() + (daysToExpire * 24 * 60 * 60 * 1000));

        const expires = `expires=${date.toUTCString()}`;
        const sameSiteAttr = `SameSite=Strict`;
        document.cookie = `${name}=${value}; ${expires}; path=/; ${sameSiteAttr}`;
    },

    getCookie: (name) => {
        const cookies = document.cookie.split('; ');
        for (const cookie of cookies) {
            const [cookieName, cookieValue] = cookie.split('=');
            if (cookieName === name) {
                return cookieValue;
            }
        }
        return null;
    },

    editCookie: (name, newValue, daysToExpire) => {
        if (CookieManager.getCookie(name) !== null) {
            CookieManager.deleteCookie(name);
        }

        CookieManager.addCookie(name, newValue, daysToExpire);
    },

    deleteCookie: (name) => {
        const date = new Date();
        date.setTime(date.getTime() - 1);

        const expires = `expires=${date.toUTCString()}`;
        const sameSiteAttr = `SameSite=Strict`;
        document.cookie = `${name}=; ${expires}; path=/; ${sameSiteAttr}`;
    },
};

let storeTransports = {
    localStorage: async (hash, name) => {
        localStorage.setItem(`EZFingerprint-${name}`, hash)
    },
    indexedDB: (hash, name) => {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open("EZFingerprint", 1);

            request.onsuccess = (event) => {
                const db = event.target.result;

                const transaction = db.transaction(["fingerprint"], "readwrite");
                const store = transaction.objectStore("fingerprint");

                store.put(hash, name);
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        })
    },
    cookie: async (hash, name) => {
        if (CookieManager.getCookie(`EZFingerprint-${name}`)) {
            CookieManager.editCookie(`EZFingerprint-${name}`, hash, 365)
        }

        CookieManager.addCookie(`EZFingerprint-${name}`, hash, 365)
    }
}

EZFingerprinter.generateFingerprint = async function (opts = {}) {
    opts = {
        skip: [],
        ...opts
    }

    await document.fonts.ready

    let fingerprint = {}

    let canvas = document.createElement('canvas')
    let gl = canvas.getContext('webgl', { failIfMajorPerformanceCaveat: false })
    const gl_debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    let fonts = [...document.fonts]
    
    fingerprint.hardware = {
        gpu: {
            vendor: gl.getParameter(gl.VENDOR),
            renderer: gl.getParameter(gl.RENDERER),
            hidden_vendor: gl.getParameter(gl_debugInfo.UNMASKED_VENDOR_WEBGL),
            hidden_renderer: gl.getParameter(gl_debugInfo.UNMASKED_RENDERER_WEBGL),
            optionalData: {},
        },

        memory: navigator.deviceMemory,
        cpus: navigator.hardwareConcurrency,
        oscpu: 'oscpu' in navigator ? navigator.oscpu : "",
        mediaDevices: [],

        display: {
            size: {
                width: window.screen.width,
                height: window.screen.height,
                colorDepth: window.screen.colorDepth,
                pixelDepth: window.screen.pixelDepth
            }
        },

        maxTouchPoints: navigator.maxTouchPoints,
    }

    fingerprint.software = {
        cookieEnabled: navigator.cookieEnabled,

        language: navigator.language,
        languages: navigator.languages,

        mediaCapabilities: { video: {}, audio: {} },

        pdfViewer: navigator.pdfViewerEnabled,
        userAgent: navigator.userAgent, // navigator.userAgentData
        webdriver: navigator.webdriver,
        buildID: navigator.buildID,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        fonts,

        productSub: 'productSub ' in navigator ? navigator.productSub : "",
        appVersion: 'appVersion' in navigator ? navigator.appVersion : "",
        platform: 'platform' in navigator ? navigator.platform : "",
        plugins: 'plugins' in navigator ? navigator.plugins : [],
    }


    fingerprint.network = {}

    if (opts.networkURL) {
        let data = await fetch(opts.networkURL)
        if (!data.ok) {
            throw new Error("network connection failed for the URL: " + opts.networkURL)
        }

        try {
            data = await data.json()

            if (opts.includeIP) {
                fingerprint.ip = data.ip
            }

            delete data.ip
            fingerprint.network = data
        } catch (err) {
            throw err
        }
    }

    if (!opts.skip.includes("mediaCapabilities")) {
        for (let type of configurations.audio) {
            let [success, supported] = await to(navigator.mediaCapabilities.decodingInfo({
                type: "file",
                audio: {
                    contentType: `audio/${type}`,
                },
            }))

            let name = type.includes(`;`) ? type.split(`;`)[0] : type

            if (!success) {
                fingerprint.software.mediaCapabilities.audio[name] = false
                continue
            }

            fingerprint.software.mediaCapabilities.audio[name] = supported.supported
        }

        for (let type of configurations.video) {
            let [success, supported] = await to(navigator.mediaCapabilities.decodingInfo({
                type: "file",
                video: {
                    contentType: `video/${type}`,
                    width: 720,
                    height: 480,
                    framerate: 24,
                    bitrate: 3 * 1000000, // 3mbps
                },
            }))

            let name = type.includes(`"`) ? type.split(`"`).at(-2).split(",")[0] : type

            if (name.includes(".")) {
                name = name.split(".")[0]
            }

            if (name.includes("-")) {
                name = name.split("-")[1]
            }


            if (!success) {
                fingerprint.software.mediaCapabilities.video[name] = false
                continue
            }

            fingerprint.software.mediaCapabilities.video[name] = supported.supported
        }
    }

    if (!opts.skip.includes("mediaDevices")) {
        for (let mediaDevice of await navigator.mediaDevices.enumerateDevices()) {
            let device = {
                kind: mediaDevice.kind,
                label: mediaDevice.label,
                deviceId: mediaDevice.deviceId
            }

            fingerprint.hardware.mediaDevices.push(device)
        }
    }

    if (!opts.skip.includes("glParameters")) {
        /*for (let key in gl) {
            if (key !== key.toUpperCase()) continue;
            if (typeof gl[key] !== 'number') continue;

            let parameter = gl.getParameter(gl[key])
            if (parameter == null) continue;

            fingerprint.hardware.gpu.optionalData[key] = parameter
        }*/
    }

    return fingerprint
}

EZFingerprinter.storeFingerprint = async function (opts = {}) {
    opts = {
        fingerprint: opts.hash || await EZFingerprinter.hashFingerprint(),
        name: opts.name || "default",
        transport: (typeof (opts.transport) == "function" && opts.transport) || (typeof (opts.transport) == "string" && storeTransports[opts.transport]) || storeTransports.cookie,
    }

    opts.transport(opts.fingerprint, opts.name)
}

EZFingerprinter.storeRawFingerprint = async function (opts = {}) {
    return EZFingerprinter.storeFingerprint({
        ...opts,
        hash: (opts.fingerprint && JSON.stringify(opts.fingerprint)) || JSON.stringify(await EZFingerprinter.generateFingerprint())
    })
}

EZFingerprinter.hashFingerprint = function (fingerprint) {
    return new Promise(async (resolve, reject) => {
        if (!fingerprint) {
            fingerprint = await EZFingerprinter.generateFingerprint()
        }

        const jsonString = JSON.stringify(fingerprint);

        const encoder = new TextEncoder();
        const data = encoder.encode(jsonString);

        window.crypto.subtle.digest('SHA-256', data).then(hashBuffer => {
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');

            resolve(hashHex);
        }).catch(reject);
    })
}

window.EZFingerprinter = EZFingerprinter