const { ocadToSvg, ocadToGeoJson } = require('ocad2geojson')
const Flatbush = require('flatbush')

const hundredsMmToMeter = 1 / (100 * 1000)

module.exports = class OcadTiler {
  constructor(ocadFile, options) {
    this.options = {
      DOMImplementation:
        typeof window !== 'undefined' ? window.DOMImplementation : null,
      ...options,
    }
    this.ocadFile = ocadFile
    this.index = new Flatbush(this.ocadFile.objects.length)

    const bounds = [
      Number.MAX_VALUE,
      Number.MAX_VALUE,
      -Number.MAX_VALUE,
      -Number.MAX_VALUE,
    ]

    for (const o of this.ocadFile.objects) {
      let minX = Number.MAX_VALUE
      let minY = Number.MAX_VALUE
      let maxX = -Number.MAX_VALUE
      let maxY = -Number.MAX_VALUE

      for (const [x, y] of o.coordinates) {
        minX = Math.min(x, minX)
        minY = Math.min(y, minY)
        maxX = Math.max(x, maxX)
        maxY = Math.max(y, maxY)
      }
      this.index.add(minX, minY, maxX, maxY)

      bounds[0] = Math.min(minX, bounds[0])
      bounds[1] = Math.min(minY, bounds[1])
      bounds[2] = Math.max(maxX, bounds[2])
      bounds[3] = Math.max(maxY, bounds[3])
    }

    this.index.finish()
    const crs = ocadFile.getCrs()
    this.bounds = [
      bounds[0] * hundredsMmToMeter * crs.scale + crs.easting,
      bounds[1] * hundredsMmToMeter * crs.scale + crs.northing,
      bounds[2] * hundredsMmToMeter * crs.scale + crs.easting,
      bounds[3] * hundredsMmToMeter * crs.scale + crs.northing,
    ]
  }

  renderGeoJson(extent, options) {
    return ocadToGeoJson(this.ocadFile, {
      objects: this.getObjects(extent),
      ...options,
    })
  }

  renderSvg(extent, resolution, options = {}) {
    const DOMImplementation = this.options.DOMImplementation
    const document = DOMImplementation.createDocument(null, 'xml', null)
    const svg = ocadToSvg(this.ocadFile, {
      objects: this.getObjects(extent, (options.buffer || 256) * resolution),
      document,
    })

    const mapGroup = svg.getElementsByTagName('g')[0]
    const crs = this.ocadFile.getCrs()
    extent = [
      (extent[0] - crs.easting) / crs.scale / hundredsMmToMeter,
      (extent[1] - crs.northing) / crs.scale / hundredsMmToMeter,
      (extent[2] - crs.easting) / crs.scale / hundredsMmToMeter,
      (extent[3] - crs.northing) / crs.scale / hundredsMmToMeter,
    ]
    const transform = `scale(${
      (hundredsMmToMeter * crs.scale) / resolution
    }) translate(${-extent[0]}, ${extent[3]})`
    mapGroup.setAttributeNS(
      'http://www.w3.org/2000/svg',
      'transform',
      transform
    )
    if (options.fill) {
      const rect = document.createElement('rect')
      rect.setAttributeNS(
        'http://www.w3.org/2000/svg',
        'fill',
        `${options.fill}`
      )
      rect.setAttributeNS('http://www.w3.org/2000/svg', 'width', '100%')
      rect.setAttributeNS('http://www.w3.org/2000/svg', 'height', '100%')
      svg.insertBefore(rect, svg.firstChild)
    }
    return svg
  }

  getObjects(extent, buffer) {
    const crs = this.ocadFile.getCrs()
    extent = [
      (extent[0] - crs.easting) / crs.scale / hundredsMmToMeter - buffer,
      (extent[1] - crs.northing) / crs.scale / hundredsMmToMeter - buffer,
      (extent[2] - crs.easting) / crs.scale / hundredsMmToMeter + buffer,
      (extent[3] - crs.northing) / crs.scale / hundredsMmToMeter + buffer,
    ]
    return this.index
      .search(extent[0], extent[1], extent[2], extent[3])
      .map(i => this.ocadFile.objects[i])
  }

  tileBounds(resolution, tileSize) {
    const projectedTileSize = tileSize * resolution
    const { bounds } = this
    return [
      roundDown(bounds[0], projectedTileSize),
      roundDown(bounds[1], projectedTileSize),
      roundUp(bounds[2], projectedTileSize),
      roundUp(bounds[3], projectedTileSize),
    ]
  }

  getTileExtent(resolution, tileSize, row, col) {
    const projectedTileSize = tileSize * resolution
    return [
      col * projectedTileSize,
      row * projectedTileSize,
      (col + 1) * projectedTileSize,
      (row + 1) * projectedTileSize,
    ]
  }
}

function roundDown(x, div) {
  return Math.floor(x / div)
}

function roundUp(x, div) {
  return Math.ceil(x / div)
}
