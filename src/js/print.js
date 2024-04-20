import Browser from './browser'
import { cleanUp } from './functions'

const Print = {
  send: (params, printFrame) => {
    // Append iframe element to document body
    document.getElementsByTagName('body')[0].appendChild(printFrame)

    // Get iframe element
    const iframeElement = document.getElementById(params.frameId)

    // Wait for iframe to load all content
    iframeElement.onload = () => {
      if (params.type === 'pdf') {
        // Add a delay for Firefox. In my tests, 1000ms was sufficient but 100ms was not
        if (Browser.isFirefox() && Browser.getFirefoxMajorVersion() < 110) {
          setTimeout(() => performPrint(iframeElement, params), 1000)
        } else {
          performPrint(iframeElement, params)
        }
        return
      }

      // Get iframe element document
      let printDocument = (iframeElement.contentWindow || iframeElement.contentDocument)
      if (printDocument.document) printDocument = printDocument.document

      // Append printable element to the iframe body
      printDocument.body.appendChild(params.printableElement)

      // Add custom style
      if (params.type !== 'pdf' && params.style) {
        // Create style element
        const style = document.createElement('style')
        style.innerHTML = params.style

        // Append style element to iframe's head
        printDocument.head.appendChild(style)
      }

      // If printing images, wait for them to load inside the iframe
      const images = printDocument.getElementsByTagName('img')

      if (images.length > 0) {
        loadIframeImages(Array.from(images)).then(() => performPrint(iframeElement, params))
      } else {
        checkStylesLoaded(printDocument, () => {
          performPrint(iframeElement, params)
        })
      }
    }
  }
}

function performPrint (iframeElement, params) {
  try {
    iframeElement.focus()

    // If Edge or IE, try catch with execCommand
    if (Browser.isEdge() || Browser.isIE()) {
      try {
        iframeElement.contentWindow.document.execCommand('print', false, null)
      } catch (e) {
        setTimeout(function () {
          iframeElement.contentWindow.print()
        }, 1000)
      }
    } else {
      // Other browsers
      setTimeout(function () {
        iframeElement.contentWindow.print()
      }, 1000)
    }
  } catch (error) {
    params.onError(error)
  } finally {
    if (Browser.isFirefox() && Browser.getFirefoxMajorVersion() < 110) {
      // Move the iframe element off-screen and make it invisible
      iframeElement.style.visibility = 'hidden'
      iframeElement.style.left = '-1px'
    }

    cleanUp(params)
  }
}

function loadIframeImages (images) {
  const promises = images.map(image => {
    if (image.src && image.src !== window.location.href) {
      return loadIframeImage(image)
    }
  })

  return Promise.all(promises)
}

function loadIframeImage (image) {
  return new Promise(resolve => {
    const pollImage = () => {
      !image || typeof image.naturalWidth === 'undefined' || image.naturalWidth === 0 || !image.complete
        ? setTimeout(pollImage, 500)
        : resolve()
    }
    pollImage()
  })
}

function checkStylesLoaded (printDocument, cb) {
  const stylesheets = printDocument.styleSheets
  let stylesLoaded = true

  for (let i = 0; i < stylesheets.length; i++) {
    if (stylesheets[i].cssRules === null) {
      stylesLoaded = false
      break
    }
  }

  if (stylesLoaded) {
    console.log('All styles loaded in iframe')
    // 在这里执行你希望在样式加载完成后执行的操作
    cb && cb()
  } else {
    // 如果样式尚未加载完毕，可以选择等待一段时间后再次检查，或执行其他操作
    setTimeout(checkStylesLoaded, 100) // 每 100 毫秒检查一次
  }
}

export default Print
