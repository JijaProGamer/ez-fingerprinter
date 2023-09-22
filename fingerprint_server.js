function parseAcceptLanguage(acceptLanguageHeader) {
    return acceptLanguageHeader
      .split(',')
      .map((language) => {
        const [codeWithQuality, ...extra] = language.split(';');
        const [code, region] = codeWithQuality.split('-');
        const quality = extra[0] ? parseFloat(extra[0].split('=')[1]) : 1.0;
  
        return {
          code,
          region: region || undefined,
          quality,
          raw: language.trim(),
        };
      })
      .filter((language) => language)
      .sort((a, b) => b.quality - a.quality);
  }

function Serve(data, trustProxy=false) {
    let result = {}

    result.headers = data.headers

    delete result.headers["host"]
    delete result.headers["referer"]
    delete result.headers["cookie"]
    delete result.headers["if-none-match"]

    result.headersLength = Object.keys(result.headers).length
    result.headersPresent = Object.keys(result.headers)
    result.languages = []
    result["sec-ch"] = {}

    result.accept = result.headers["accept"]
    result["user-agent"] = result.headers["user-agent"]
    result.ip = data.ip

    if(trustProxy){
        result.ip = result.headers["x-forwarded-for"].split(',')[0]
    }

    delete result.headers["x-forwarded-proto"]
    delete result.headers["x-forwarded-for"]
    delete result.headers["x-real-ip"]

    result.headersPresent.forEach(element => {
        if (!element.includes("sec-ch")) return;

        result["sec-ch"][element] = result.headers[element]
    })

    let languagesRaw = result.headers["accept-language"]
    if (languagesRaw) {        
        result.languages = parseAcceptLanguage(languagesRaw)
    }

    return result
}

function ServeHTTP(request, trustProxy=false) {
    return Serve({
        headers: request.headers,
        ip: request.connection.remoteAddress
    }, trustProxy)
}

function ServeExpress(request, trustProxy=false) {
    return Serve({
        headers: request.headers,
        ip: request.connection.remoteAddress
    }, trustProxy)
}

module.exports = { ServeHTTP, ServeExpress, Serve };