import { version } from 'echarts/lib/echarts'

export const ecVer = version.split('.')

export const isNewEC = ecVer[0] > 4

export const COMPONENT_TYPE = 'tmap'

export function v2Equal(a, b) {
  return a && b && a[0] === b[0] && a[1] === b[1]
}

let logMap = {}

export function logWarn(tag, msg, once) {
  const log = `[ECharts][Extension][TMap]${tag ? ' ' + tag + ':' : ''} ${msg}`
  once && logMap[log] || console.warn(log)
  once && (logMap[log] = true)
}

export function clearLogMap() {
  logMap = {}
}
