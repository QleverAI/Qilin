import { useWindowDimensions } from 'react-native'

/**
 * Breakpoints (ancho lógico, no pixels físicos):
 *   phone   < 600   iPhone + Android teléfonos
 *   tablet  600-900 iPad mini/Air portrait, Android tablets
 *   wide   ≥ 900    iPad Pro, landscape, tablet grande
 *
 * Uso:
 *   const { isTablet, columns } = useBreakpoint()
 *   <FlatList numColumns={columns} ... />
 */
export function useBreakpoint() {
  const { width, height } = useWindowDimensions()
  const isTablet = width >= 600 && width < 900
  const isWide   = width >= 900
  const isPhone  = !isTablet && !isWide
  const isLandscape = width > height

  return {
    width,
    height,
    isPhone,
    isTablet,
    isWide,
    isLandscape,
    // Conveniencia: número de columnas sugerido para listas/grids
    columns: isWide ? 3 : isTablet ? 2 : 1,
    // Contenedor con ancho máximo en tablet (evita lineas de texto demasiado largas)
    maxContentWidth: isWide ? 900 : isTablet ? 720 : undefined,
    // Padding horizontal base
    hPad: isWide ? 32 : isTablet ? 24 : 16,
  }
}
