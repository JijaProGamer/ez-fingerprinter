if (!window.crypto) {
    throw new Error("Web Crypto API is not available in this browser.")
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


let EZFingerprinter = {}

let storeTransports = {
    localStorage: async (hash) => {
        localStorage.setItem("EZFingerprint", hash)
    },
    indexedDB: (hash) => {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open("EZFingerprint", 1);

            request.onsuccess = (event) => {
                const db = event.target.result;

                const transaction = db.transaction(["fingerprint"], "readwrite");
                const store = transaction.objectStore("fingerprint");

                store.put("EZFingerprint", hash);
            };
        })
    },
    cookie: async (hash) => {
        if(CookieManager.getCookie("EZFingerprint")){
            CookieManager.editCookie("EZFingerprint", hash, 365)
        }

        CookieManager.addCookie("EZFingerprint", hash, 365)
    }
}

EZFingerprinter.generateFingerprint = async function () {
    let fingerprint = {}

    return fingerprint
}

EZFingerprinter.storeFingerprint = async function (opts = {}) {
    opts = {
        fingerprint: opts.hash || await EZFingerprinter.hashFingerprint(),
        transport: (typeof (opts.transport) == "function" && opts.transport) || (typeof (opts.transport) == "string" && storeTransports[opts.transport]) || storeTransports.cookie,
    }

    opts.transport(opts.fingerprint)
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