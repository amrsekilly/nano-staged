const IS_WINDOWS = process.platform === 'win32'

const ENVIRONMENT_VARIABLE_CASINGS_IF_WINDOWS = IS_WINDOWS
  ? (() => {
      const map = new Map()
      for (const caseSensitiveName of Object.keys(process.env)) {
        const lowerCaseName = caseSensitiveName.toLowerCase()
        let arr = map.get(lowerCaseName)
        if (arr === undefined) {
          arr = []
          map.set(lowerCaseName, arr)
        }
        arr.push(caseSensitiveName)
      }
      return map
    })()
  : undefined

export const augmentProcessEnvSafelyIfOnWindows = (augmentations) => {
  if (ENVIRONMENT_VARIABLE_CASINGS_IF_WINDOWS === undefined) {
    return { ...process.env, ...augmentations }
  }
  const augmented = { ...process.env }
  for (const [name, value] of Object.entries(augmentations)) {
    const existingNames = ENVIRONMENT_VARIABLE_CASINGS_IF_WINDOWS.get(name.toLowerCase())
    if (existingNames === undefined) {
      augmented[name] = value
    } else {
      for (const existingName of existingNames) {
        augmented[existingName] = value
      }
    }
  }
  return augmented
}
