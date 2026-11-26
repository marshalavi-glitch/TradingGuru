import React from 'react';

export type MultiChartLayoutId =
  // 1 Chart
  | '1_single'
  // 2 Charts
  | '2_vertical'
  | '2_horizontal'
  // 3 Charts
  | '3_top_one_bottom_two'
  | '3_bottom_one_top_two'
  | '3_left_one_right_two'
  | '3_right_one_left_two'
  | '3_vertical'
  | '3_horizontal'
  // 4 Charts
  | '4_grid'
  | '4_vertical'
  | '4_horizontal'
  | '4_left_tall'
  | '4_top_wide'
  // 5 Charts
  | '5_two_top_three_bottom'
  | '5_three_top_two_bottom'
  | '5_left_tall_four_grid'
  | '5_top_wide_four_grid'
  // 6 Charts
  | '6_grid_3x2'
  | '6_grid_2x3'
  | '6_left_tall_five_grid'
  | '6_top_wide_five'
  // 7 Charts
  | '7_three_top_four_bottom'
  | '7_four_top_three_bottom'
  | '7_left_tall_six_grid'
  // 8 Charts
  | '8_grid_4x2'
  | '8_grid_2x4'
  | '8_left_two_tall_six_grid'
  | '8_top_wide_seven';

export interface MultiChartLayoutConfig {
  id: MultiChartLayoutId;
  chartCount: number;
  label: string;
  category: number;
  description: string;
  gridStyle: (isMobile: boolean) => React.CSSProperties;
  getCellStyle: (index: number, isMobile: boolean) => React.CSSProperties;
}

export const ALL_CHART_LAYOUTS: MultiChartLayoutConfig[] = [
  // ---------------- 1 CHART ----------------
  {
    id: '1_single',
    chartCount: 1,
    category: 1,
    label: 'Single Chart',
    description: '1 Fullscreen Chart',
    gridStyle: () => ({
      display: 'grid',
      gridTemplateColumns: '1fr',
      gridTemplateRows: '1fr',
      gap: '4px',
      width: '100%',
      height: '100%',
      flex: 1,
      minHeight: 0,
      minWidth: 0,
      overflow: 'hidden'
    }),
    getCellStyle: () => ({ width: '100%', height: '100%', minHeight: 0, minWidth: 0 })
  },

  // ---------------- 2 CHARTS ----------------
  {
    id: '2_vertical',
    chartCount: 2,
    category: 2,
    label: '2 Columns',
    description: 'Side-by-side vertical split',
    gridStyle: (isMobile) => ({
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
      gridTemplateRows: isMobile ? '1fr 1fr' : '1fr',
      gap: '4px',
      width: '100%',
      height: '100%',
      flex: 1,
      minHeight: 0,
      minWidth: 0,
      overflow: 'hidden'
    }),
    getCellStyle: () => ({ width: '100%', height: '100%', minHeight: 0, minWidth: 0 })
  },
  {
    id: '2_horizontal',
    chartCount: 2,
    category: 2,
    label: '2 Rows',
    description: 'Stacked horizontal split',
    gridStyle: () => ({
      display: 'grid',
      gridTemplateColumns: '1fr',
      gridTemplateRows: '1fr 1fr',
      gap: '4px',
      width: '100%',
      height: '100%',
      flex: 1,
      minHeight: 0,
      minWidth: 0,
      overflow: 'hidden'
    }),
    getCellStyle: () => ({ width: '100%', height: '100%', minHeight: 0, minWidth: 0 })
  },

  // ---------------- 3 CHARTS ----------------
  {
    id: '3_top_one_bottom_two',
    chartCount: 3,
    category: 3,
    label: '1 Top, 2 Bottom',
    description: 'Wide chart on top, two below',
    gridStyle: (isMobile) => ({
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
      gridTemplateRows: isMobile ? 'repeat(3, 1fr)' : '1.1fr 1fr',
      gap: '4px',
      width: '100%',
      height: '100%',
      flex: 1,
      minHeight: 0,
      minWidth: 0,
      overflow: 'hidden'
    }),
    getCellStyle: (index, isMobile) => {
      if (isMobile) return { width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      if (index === 0) return { gridColumn: '1 / span 2', gridRow: '1', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      if (index === 1) return { gridColumn: '1 / 2', gridRow: '2', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      return { gridColumn: '2 / 3', gridRow: '2', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
    }
  },
  {
    id: '3_bottom_one_top_two',
    chartCount: 3,
    category: 3,
    label: '2 Top, 1 Bottom',
    description: 'Two charts on top, wide below',
    gridStyle: (isMobile) => ({
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
      gridTemplateRows: isMobile ? 'repeat(3, 1fr)' : '1fr 1.1fr',
      gap: '4px',
      width: '100%',
      height: '100%',
      flex: 1,
      minHeight: 0,
      minWidth: 0,
      overflow: 'hidden'
    }),
    getCellStyle: (index, isMobile) => {
      if (isMobile) return { width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      if (index === 0) return { gridColumn: '1 / 2', gridRow: '1', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      if (index === 1) return { gridColumn: '2 / 3', gridRow: '1', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      return { gridColumn: '1 / span 2', gridRow: '2', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
    }
  },
  {
    id: '3_left_one_right_two',
    chartCount: 3,
    category: 3,
    label: '1 Left, 2 Right',
    description: 'Tall chart on left, two stacked on right',
    gridStyle: (isMobile) => ({
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : '1.1fr 1fr',
      gridTemplateRows: isMobile ? 'repeat(3, 1fr)' : '1fr 1fr',
      gap: '4px',
      width: '100%',
      height: '100%',
      flex: 1,
      minHeight: 0,
      minWidth: 0,
      overflow: 'hidden'
    }),
    getCellStyle: (index, isMobile) => {
      if (isMobile) return { width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      if (index === 0) return { gridColumn: '1', gridRow: '1 / span 2', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      if (index === 1) return { gridColumn: '2', gridRow: '1', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      return { gridColumn: '2', gridRow: '2', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
    }
  },
  {
    id: '3_right_one_left_two',
    chartCount: 3,
    category: 3,
    label: '2 Left, 1 Right',
    description: 'Two stacked on left, tall chart on right',
    gridStyle: (isMobile) => ({
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : '1fr 1.1fr',
      gridTemplateRows: isMobile ? 'repeat(3, 1fr)' : '1fr 1fr',
      gap: '4px',
      width: '100%',
      height: '100%',
      flex: 1,
      minHeight: 0,
      minWidth: 0,
      overflow: 'hidden'
    }),
    getCellStyle: (index, isMobile) => {
      if (isMobile) return { width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      if (index === 0) return { gridColumn: '1', gridRow: '1', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      if (index === 1) return { gridColumn: '1', gridRow: '2', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      return { gridColumn: '2', gridRow: '1 / span 2', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
    }
  },
  {
    id: '3_vertical',
    chartCount: 3,
    category: 3,
    label: '3 Columns',
    description: 'Three vertical columns side-by-side',
    gridStyle: (isMobile) => ({
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
      gridTemplateRows: isMobile ? 'repeat(3, 1fr)' : '1fr',
      gap: '4px',
      width: '100%',
      height: '100%',
      flex: 1,
      minHeight: 0,
      minWidth: 0,
      overflow: 'hidden'
    }),
    getCellStyle: () => ({ width: '100%', height: '100%', minHeight: 0, minWidth: 0 })
  },
  {
    id: '3_horizontal',
    chartCount: 3,
    category: 3,
    label: '3 Rows',
    description: 'Three horizontal rows stacked',
    gridStyle: () => ({
      display: 'grid',
      gridTemplateColumns: '1fr',
      gridTemplateRows: 'repeat(3, 1fr)',
      gap: '4px',
      width: '100%',
      height: '100%',
      flex: 1,
      minHeight: 0,
      minWidth: 0,
      overflow: 'hidden'
    }),
    getCellStyle: () => ({ width: '100%', height: '100%', minHeight: 0, minWidth: 0 })
  },

  // ---------------- 4 CHARTS ----------------
  {
    id: '4_grid',
    chartCount: 4,
    category: 4,
    label: '2x2 Grid',
    description: 'Four equal charts in 2x2 grid',
    gridStyle: (isMobile) => ({
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
      gridTemplateRows: isMobile ? 'repeat(4, 1fr)' : '1fr 1fr',
      gap: '4px',
      width: '100%',
      height: '100%',
      flex: 1,
      minHeight: 0,
      minWidth: 0,
      overflow: 'hidden'
    }),
    getCellStyle: () => ({ width: '100%', height: '100%', minHeight: 0, minWidth: 0 })
  },
  {
    id: '4_vertical',
    chartCount: 4,
    category: 4,
    label: '4 Columns',
    description: 'Four vertical columns side-by-side',
    gridStyle: (isMobile) => ({
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)',
      gridTemplateRows: isMobile ? 'repeat(4, 1fr)' : '1fr',
      gap: '4px',
      width: '100%',
      height: '100%',
      flex: 1,
      minHeight: 0,
      minWidth: 0,
      overflow: 'hidden'
    }),
    getCellStyle: () => ({ width: '100%', height: '100%', minHeight: 0, minWidth: 0 })
  },
  {
    id: '4_horizontal',
    chartCount: 4,
    category: 4,
    label: '4 Rows',
    description: 'Four horizontal rows stacked',
    gridStyle: () => ({
      display: 'grid',
      gridTemplateColumns: '1fr',
      gridTemplateRows: 'repeat(4, 1fr)',
      gap: '4px',
      width: '100%',
      height: '100%',
      flex: 1,
      minHeight: 0,
      minWidth: 0,
      overflow: 'hidden'
    }),
    getCellStyle: () => ({ width: '100%', height: '100%', minHeight: 0, minWidth: 0 })
  },
  {
    id: '4_left_tall',
    chartCount: 4,
    category: 4,
    label: '1 Left, 3 Right',
    description: 'Tall chart on left, three stacked on right',
    gridStyle: (isMobile) => ({
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : '1.2fr 1fr',
      gridTemplateRows: isMobile ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)',
      gap: '4px',
      width: '100%',
      height: '100%',
      flex: 1,
      minHeight: 0,
      minWidth: 0,
      overflow: 'hidden'
    }),
    getCellStyle: (index, isMobile) => {
      if (isMobile) return { width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      if (index === 0) return { gridColumn: '1', gridRow: '1 / span 3', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      if (index === 1) return { gridColumn: '2', gridRow: '1', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      if (index === 2) return { gridColumn: '2', gridRow: '2', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      return { gridColumn: '2', gridRow: '3', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
    }
  },
  {
    id: '4_top_wide',
    chartCount: 4,
    category: 4,
    label: '1 Top, 3 Bottom',
    description: 'Wide chart on top, three columns below',
    gridStyle: (isMobile) => ({
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
      gridTemplateRows: isMobile ? 'repeat(4, 1fr)' : '1.2fr 1fr',
      gap: '4px',
      width: '100%',
      height: '100%',
      flex: 1,
      minHeight: 0,
      minWidth: 0,
      overflow: 'hidden'
    }),
    getCellStyle: (index, isMobile) => {
      if (isMobile) return { width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      if (index === 0) return { gridColumn: '1 / span 3', gridRow: '1', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      if (index === 1) return { gridColumn: '1', gridRow: '2', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      if (index === 2) return { gridColumn: '2', gridRow: '2', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      return { gridColumn: '3', gridRow: '2', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
    }
  },

  // ---------------- 5 CHARTS ----------------
  {
    id: '5_two_top_three_bottom',
    chartCount: 5,
    category: 5,
    label: '2 Top, 3 Bottom',
    description: 'Two wide charts on top, three below',
    gridStyle: (isMobile) => ({
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : 'repeat(6, 1fr)',
      gridTemplateRows: isMobile ? 'repeat(5, 1fr)' : '1fr 1fr',
      gap: '4px',
      width: '100%',
      height: '100%',
      flex: 1,
      minHeight: 0,
      minWidth: 0,
      overflow: 'hidden'
    }),
    getCellStyle: (index, isMobile) => {
      if (isMobile) return { width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      if (index === 0) return { gridColumn: 'span 3', gridRow: '1', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      if (index === 1) return { gridColumn: 'span 3', gridRow: '1', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      if (index === 2) return { gridColumn: 'span 2', gridRow: '2', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      if (index === 3) return { gridColumn: 'span 2', gridRow: '2', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      return { gridColumn: 'span 2', gridRow: '2', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
    }
  },
  {
    id: '5_three_top_two_bottom',
    chartCount: 5,
    category: 5,
    label: '3 Top, 2 Bottom',
    description: 'Three charts on top, two wide below',
    gridStyle: (isMobile) => ({
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : 'repeat(6, 1fr)',
      gridTemplateRows: isMobile ? 'repeat(5, 1fr)' : '1fr 1fr',
      gap: '4px',
      width: '100%',
      height: '100%',
      flex: 1,
      minHeight: 0,
      minWidth: 0,
      overflow: 'hidden'
    }),
    getCellStyle: (index, isMobile) => {
      if (isMobile) return { width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      if (index === 0) return { gridColumn: 'span 2', gridRow: '1', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      if (index === 1) return { gridColumn: 'span 2', gridRow: '1', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      if (index === 2) return { gridColumn: 'span 2', gridRow: '1', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      if (index === 3) return { gridColumn: 'span 3', gridRow: '2', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      return { gridColumn: 'span 3', gridRow: '2', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
    }
  },
  {
    id: '5_left_tall_four_grid',
    chartCount: 5,
    category: 5,
    label: '1 Left, 4 Grid',
    description: 'Tall chart on left, 2x2 grid on right',
    gridStyle: (isMobile) => ({
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : '1.2fr 1fr 1fr',
      gridTemplateRows: isMobile ? 'repeat(5, 1fr)' : '1fr 1fr',
      gap: '4px',
      width: '100%',
      height: '100%',
      flex: 1,
      minHeight: 0,
      minWidth: 0,
      overflow: 'hidden'
    }),
    getCellStyle: (index, isMobile) => {
      if (isMobile) return { width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      if (index === 0) return { gridColumn: '1', gridRow: '1 / span 2', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      if (index === 1) return { gridColumn: '2', gridRow: '1', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      if (index === 2) return { gridColumn: '3', gridRow: '1', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      if (index === 3) return { gridColumn: '2', gridRow: '2', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      return { gridColumn: '3', gridRow: '2', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
    }
  },

  // ---------------- 6 CHARTS ----------------
  {
    id: '6_grid_3x2',
    chartCount: 6,
    category: 6,
    label: '3x2 Grid',
    description: 'Three columns by two rows (3x2)',
    gridStyle: (isMobile) => ({
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
      gridTemplateRows: isMobile ? 'repeat(6, 1fr)' : '1fr 1fr',
      gap: '4px',
      width: '100%',
      height: '100%',
      flex: 1,
      minHeight: 0,
      minWidth: 0,
      overflow: 'hidden'
    }),
    getCellStyle: () => ({ width: '100%', height: '100%', minHeight: 0, minWidth: 0 })
  },
  {
    id: '6_grid_2x3',
    chartCount: 6,
    category: 6,
    label: '2x3 Grid',
    description: 'Two columns by three rows (2x3)',
    gridStyle: (isMobile) => ({
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
      gridTemplateRows: isMobile ? 'repeat(6, 1fr)' : 'repeat(3, 1fr)',
      gap: '4px',
      width: '100%',
      height: '100%',
      flex: 1,
      minHeight: 0,
      minWidth: 0,
      overflow: 'hidden'
    }),
    getCellStyle: () => ({ width: '100%', height: '100%', minHeight: 0, minWidth: 0 })
  },
  {
    id: '6_left_tall_five_grid',
    chartCount: 6,
    category: 6,
    label: '1 Left, 5 Right',
    description: 'Tall chart on left, 2 top right, 3 bottom right',
    gridStyle: (isMobile) => ({
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : 'repeat(7, 1fr)',
      gridTemplateRows: isMobile ? 'repeat(6, 1fr)' : '1fr 1fr',
      gap: '4px',
      width: '100%',
      height: '100%',
      flex: 1,
      minHeight: 0,
      minWidth: 0,
      overflow: 'hidden'
    }),
    getCellStyle: (index, isMobile) => {
      if (isMobile) return { width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      if (index === 0) return { gridColumn: '1 / span 2', gridRow: '1 / span 2', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      // Row 1 right: 2 charts
      if (index === 1) return { gridColumn: '3 / span 3', gridRow: '1', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      if (index === 2) return { gridColumn: '6 / span 2', gridRow: '1', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      // Row 2 right: 3 charts
      if (index === 3) return { gridColumn: '3 / span 2', gridRow: '2', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      if (index === 4) return { gridColumn: '5 / span 2', gridRow: '2', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      return { gridColumn: '7 / span 1', gridRow: '2', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
    }
  },

  // ---------------- 7 CHARTS ----------------
  {
    id: '7_three_top_four_bottom',
    chartCount: 7,
    category: 7,
    label: '3 Top, 4 Bottom',
    description: 'Three charts on top, four below',
    gridStyle: (isMobile) => ({
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : 'repeat(12, 1fr)',
      gridTemplateRows: isMobile ? 'repeat(7, 1fr)' : '1fr 1fr',
      gap: '4px',
      width: '100%',
      height: '100%',
      flex: 1,
      minHeight: 0,
      minWidth: 0,
      overflow: 'hidden'
    }),
    getCellStyle: (index, isMobile) => {
      if (isMobile) return { width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      if (index === 0) return { gridColumn: '1 / span 4', gridRow: '1', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      if (index === 1) return { gridColumn: '5 / span 4', gridRow: '1', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      if (index === 2) return { gridColumn: '9 / span 4', gridRow: '1', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      if (index === 3) return { gridColumn: '1 / span 3', gridRow: '2', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      if (index === 4) return { gridColumn: '4 / span 3', gridRow: '2', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      if (index === 5) return { gridColumn: '7 / span 3', gridRow: '2', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      return { gridColumn: '10 / span 3', gridRow: '2', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
    }
  },
  {
    id: '7_four_top_three_bottom',
    chartCount: 7,
    category: 7,
    label: '4 Top, 3 Bottom',
    description: 'Four charts on top, three below',
    gridStyle: (isMobile) => ({
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : 'repeat(12, 1fr)',
      gridTemplateRows: isMobile ? 'repeat(7, 1fr)' : '1fr 1fr',
      gap: '4px',
      width: '100%',
      height: '100%',
      flex: 1,
      minHeight: 0,
      minWidth: 0,
      overflow: 'hidden'
    }),
    getCellStyle: (index, isMobile) => {
      if (isMobile) return { width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      if (index === 0) return { gridColumn: '1 / span 3', gridRow: '1', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      if (index === 1) return { gridColumn: '4 / span 3', gridRow: '1', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      if (index === 2) return { gridColumn: '7 / span 3', gridRow: '1', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      if (index === 3) return { gridColumn: '10 / span 3', gridRow: '1', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      if (index === 4) return { gridColumn: '1 / span 4', gridRow: '2', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      if (index === 5) return { gridColumn: '5 / span 4', gridRow: '2', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      return { gridColumn: '9 / span 4', gridRow: '2', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
    }
  },
  {
    id: '7_left_tall_six_grid',
    chartCount: 7,
    category: 7,
    label: '1 Left, 6 Grid',
    description: 'Tall chart on left, 3x2 grid on right',
    gridStyle: (isMobile) => ({
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : '1.2fr repeat(3, 1fr)',
      gridTemplateRows: isMobile ? 'repeat(7, 1fr)' : '1fr 1fr',
      gap: '4px',
      width: '100%',
      height: '100%',
      flex: 1,
      minHeight: 0,
      minWidth: 0,
      overflow: 'hidden'
    }),
    getCellStyle: (index, isMobile) => {
      if (isMobile) return { width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      if (index === 0) return { gridColumn: '1', gridRow: '1 / span 2', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      if (index === 1) return { gridColumn: '2', gridRow: '1', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      if (index === 2) return { gridColumn: '3', gridRow: '1', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      if (index === 3) return { gridColumn: '4', gridRow: '1', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      if (index === 4) return { gridColumn: '2', gridRow: '2', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      if (index === 5) return { gridColumn: '3', gridRow: '2', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      return { gridColumn: '4', gridRow: '2', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
    }
  },

  // ---------------- 8 CHARTS ----------------
  {
    id: '8_grid_4x2',
    chartCount: 8,
    category: 8,
    label: '4x2 Grid',
    description: 'Four columns by two rows (4x2)',
    gridStyle: (isMobile) => ({
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)',
      gridTemplateRows: isMobile ? 'repeat(8, 1fr)' : '1fr 1fr',
      gap: '4px',
      width: '100%',
      height: '100%',
      flex: 1,
      minHeight: 0,
      minWidth: 0,
      overflow: 'hidden'
    }),
    getCellStyle: () => ({ width: '100%', height: '100%', minHeight: 0, minWidth: 0 })
  },
  {
    id: '8_grid_2x4',
    chartCount: 8,
    category: 8,
    label: '2x4 Grid',
    description: 'Two columns by four rows (2x4)',
    gridStyle: (isMobile) => ({
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
      gridTemplateRows: isMobile ? 'repeat(8, 1fr)' : 'repeat(4, 1fr)',
      gap: '4px',
      width: '100%',
      height: '100%',
      flex: 1,
      minHeight: 0,
      minWidth: 0,
      overflow: 'hidden'
    }),
    getCellStyle: () => ({ width: '100%', height: '100%', minHeight: 0, minWidth: 0 })
  },
  {
    id: '8_left_two_tall_six_grid',
    chartCount: 8,
    category: 8,
    label: '2 Tall Left, 6 Grid',
    description: 'Two tall charts on left, 3x2 grid on right',
    gridStyle: (isMobile) => ({
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : '1.1fr 1.1fr repeat(3, 1fr)',
      gridTemplateRows: isMobile ? 'repeat(8, 1fr)' : '1fr 1fr',
      gap: '4px',
      width: '100%',
      height: '100%',
      flex: 1,
      minHeight: 0,
      minWidth: 0,
      overflow: 'hidden'
    }),
    getCellStyle: (index, isMobile) => {
      if (isMobile) return { width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      if (index === 0) return { gridColumn: '1', gridRow: '1 / span 2', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      if (index === 1) return { gridColumn: '2', gridRow: '1 / span 2', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      if (index === 2) return { gridColumn: '3', gridRow: '1', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      if (index === 3) return { gridColumn: '4', gridRow: '1', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      if (index === 4) return { gridColumn: '5', gridRow: '1', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      if (index === 5) return { gridColumn: '3', gridRow: '2', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      if (index === 6) return { gridColumn: '4', gridRow: '2', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      return { gridColumn: '5', gridRow: '2', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
    }
  }
];

// Helper to look up layout configuration with fallback & backwards compatibility for numbers 1 to 8
export function getLayoutConfig(layout: MultiChartLayoutId | number | string): MultiChartLayoutConfig {
  if (typeof layout === 'number' || (typeof layout === 'string' && /^[1-8]$/.test(layout))) {
    const num = typeof layout === 'number' ? layout : parseInt(layout, 10);
    switch (num) {
      case 1: return ALL_CHART_LAYOUTS.find(l => l.id === '1_single')!;
      case 2: return ALL_CHART_LAYOUTS.find(l => l.id === '2_vertical')!;
      case 3: return ALL_CHART_LAYOUTS.find(l => l.id === '3_top_one_bottom_two')!;
      case 4: return ALL_CHART_LAYOUTS.find(l => l.id === '4_grid')!;
      case 5: return ALL_CHART_LAYOUTS.find(l => l.id === '5_two_top_three_bottom')!;
      case 6: return ALL_CHART_LAYOUTS.find(l => l.id === '6_grid_3x2')!;
      case 7: return ALL_CHART_LAYOUTS.find(l => l.id === '7_three_top_four_bottom')!;
      case 8: return ALL_CHART_LAYOUTS.find(l => l.id === '8_grid_4x2')!;
      default: return ALL_CHART_LAYOUTS[0];
    }
  }
  const found = ALL_CHART_LAYOUTS.find(l => l.id === layout);
  return found || ALL_CHART_LAYOUTS[1]; // fallback to 2_vertical
}

/**
 * Visual miniature SVG layout icon matching TradingView design
 */
export const LayoutPreviewIcon: React.FC<{
  layoutId: MultiChartLayoutId;
  isSelected?: boolean;
  size?: { width: number; height: number };
}> = ({ layoutId, isSelected = false, size = { width: 34, height: 24 } }) => {
  const { width, height } = size;
  const strokeColor = isSelected ? '#38bdf8' : 'rgba(255, 255, 255, 0.4)';
  const fillColor = isSelected ? 'rgba(56, 189, 248, 0.18)' : 'rgba(255, 255, 255, 0.04)';
  const dividerColor = isSelected ? '#38bdf8' : 'rgba(255, 255, 255, 0.5)';
  const strokeWidth = 1.2;

  // Render miniature line segments for each layout
  const renderDividers = () => {
    switch (layoutId) {
      case '1_single':
        return null;

      case '2_vertical':
        return <line x1={width / 2} y1={1} x2={width / 2} y2={height - 1} stroke={dividerColor} strokeWidth={strokeWidth} />;

      case '2_horizontal':
        return <line x1={1} y1={height / 2} x2={width - 1} y2={height / 2} stroke={dividerColor} strokeWidth={strokeWidth} />;

      case '3_top_one_bottom_two':
        return (
          <>
            <line x1={1} y1={height / 2} x2={width - 1} y2={height / 2} stroke={dividerColor} strokeWidth={strokeWidth} />
            <line x1={width / 2} y1={height / 2} x2={width / 2} y2={height - 1} stroke={dividerColor} strokeWidth={strokeWidth} />
          </>
        );

      case '3_bottom_one_top_two':
        return (
          <>
            <line x1={1} y1={height / 2} x2={width - 1} y2={height / 2} stroke={dividerColor} strokeWidth={strokeWidth} />
            <line x1={width / 2} y1={1} x2={width / 2} y2={height / 2} stroke={dividerColor} strokeWidth={strokeWidth} />
          </>
        );

      case '3_left_one_right_two':
        return (
          <>
            <line x1={width / 2} y1={1} x2={width / 2} y2={height - 1} stroke={dividerColor} strokeWidth={strokeWidth} />
            <line x1={width / 2} y1={height / 2} x2={width - 1} y2={height / 2} stroke={dividerColor} strokeWidth={strokeWidth} />
          </>
        );

      case '3_right_one_left_two':
        return (
          <>
            <line x1={width / 2} y1={1} x2={width / 2} y2={height - 1} stroke={dividerColor} strokeWidth={strokeWidth} />
            <line x1={1} y1={height / 2} x2={width / 2} y2={height / 2} stroke={dividerColor} strokeWidth={strokeWidth} />
          </>
        );

      case '3_vertical':
        return (
          <>
            <line x1={width / 3} y1={1} x2={width / 3} y2={height - 1} stroke={dividerColor} strokeWidth={strokeWidth} />
            <line x1={(width * 2) / 3} y1={1} x2={(width * 2) / 3} y2={height - 1} stroke={dividerColor} strokeWidth={strokeWidth} />
          </>
        );

      case '3_horizontal':
        return (
          <>
            <line x1={1} y1={height / 3} x2={width - 1} y2={height / 3} stroke={dividerColor} strokeWidth={strokeWidth} />
            <line x1={1} y1={(height * 2) / 3} x2={width - 1} y2={(height * 2) / 3} stroke={dividerColor} strokeWidth={strokeWidth} />
          </>
        );

      case '4_grid':
        return (
          <>
            <line x1={width / 2} y1={1} x2={width / 2} y2={height - 1} stroke={dividerColor} strokeWidth={strokeWidth} />
            <line x1={1} y1={height / 2} x2={width - 1} y2={height / 2} stroke={dividerColor} strokeWidth={strokeWidth} />
          </>
        );

      case '4_vertical':
        return (
          <>
            <line x1={width / 4} y1={1} x2={width / 4} y2={height - 1} stroke={dividerColor} strokeWidth={strokeWidth} />
            <line x1={width / 2} y1={1} x2={width / 2} y2={height - 1} stroke={dividerColor} strokeWidth={strokeWidth} />
            <line x1={(width * 3) / 4} y1={1} x2={(width * 3) / 4} y2={height - 1} stroke={dividerColor} strokeWidth={strokeWidth} />
          </>
        );

      case '4_horizontal':
        return (
          <>
            <line x1={1} y1={height / 4} x2={width - 1} y2={height / 4} stroke={dividerColor} strokeWidth={strokeWidth} />
            <line x1={1} y1={height / 2} x2={width - 1} y2={height / 2} stroke={dividerColor} strokeWidth={strokeWidth} />
            <line x1={1} y1={(height * 3) / 4} x2={width - 1} y2={(height * 3) / 4} stroke={dividerColor} strokeWidth={strokeWidth} />
          </>
        );

      case '4_left_tall':
        return (
          <>
            <line x1={width * 0.45} y1={1} x2={width * 0.45} y2={height - 1} stroke={dividerColor} strokeWidth={strokeWidth} />
            <line x1={width * 0.45} y1={height / 3} x2={width - 1} y2={height / 3} stroke={dividerColor} strokeWidth={strokeWidth} />
            <line x1={width * 0.45} y1={(height * 2) / 3} x2={width - 1} y2={(height * 2) / 3} stroke={dividerColor} strokeWidth={strokeWidth} />
          </>
        );

      case '4_top_wide':
        return (
          <>
            <line x1={1} y1={height * 0.48} x2={width - 1} y2={height * 0.48} stroke={dividerColor} strokeWidth={strokeWidth} />
            <line x1={width / 3} y1={height * 0.48} x2={width / 3} y2={height - 1} stroke={dividerColor} strokeWidth={strokeWidth} />
            <line x1={(width * 2) / 3} y1={height * 0.48} x2={(width * 2) / 3} y2={height - 1} stroke={dividerColor} strokeWidth={strokeWidth} />
          </>
        );

      case '5_two_top_three_bottom':
        return (
          <>
            <line x1={1} y1={height / 2} x2={width - 1} y2={height / 2} stroke={dividerColor} strokeWidth={strokeWidth} />
            <line x1={width / 2} y1={1} x2={width / 2} y2={height / 2} stroke={dividerColor} strokeWidth={strokeWidth} />
            <line x1={width / 3} y1={height / 2} x2={width / 3} y2={height - 1} stroke={dividerColor} strokeWidth={strokeWidth} />
            <line x1={(width * 2) / 3} y1={height / 2} x2={(width * 2) / 3} y2={height - 1} stroke={dividerColor} strokeWidth={strokeWidth} />
          </>
        );

      case '5_three_top_two_bottom':
        return (
          <>
            <line x1={1} y1={height / 2} x2={width - 1} y2={height / 2} stroke={dividerColor} strokeWidth={strokeWidth} />
            <line x1={width / 3} y1={1} x2={width / 3} y2={height / 2} stroke={dividerColor} strokeWidth={strokeWidth} />
            <line x1={(width * 2) / 3} y1={1} x2={(width * 2) / 3} y2={height / 2} stroke={dividerColor} strokeWidth={strokeWidth} />
            <line x1={width / 2} y1={height / 2} x2={width / 2} y2={height - 1} stroke={dividerColor} strokeWidth={strokeWidth} />
          </>
        );

      case '5_left_tall_four_grid':
        return (
          <>
            <line x1={width * 0.4} y1={1} x2={width * 0.4} y2={height - 1} stroke={dividerColor} strokeWidth={strokeWidth} />
            <line x1={width * 0.4} y1={height / 2} x2={width - 1} y2={height / 2} stroke={dividerColor} strokeWidth={strokeWidth} />
            <line x1={width * 0.7} y1={1} x2={width * 0.7} y2={height - 1} stroke={dividerColor} strokeWidth={strokeWidth} />
          </>
        );

      case '6_grid_3x2':
        return (
          <>
            <line x1={1} y1={height / 2} x2={width - 1} y2={height / 2} stroke={dividerColor} strokeWidth={strokeWidth} />
            <line x1={width / 3} y1={1} x2={width / 3} y2={height - 1} stroke={dividerColor} strokeWidth={strokeWidth} />
            <line x1={(width * 2) / 3} y1={1} x2={(width * 2) / 3} y2={height - 1} stroke={dividerColor} strokeWidth={strokeWidth} />
          </>
        );

      case '6_grid_2x3':
        return (
          <>
            <line x1={width / 2} y1={1} x2={width / 2} y2={height - 1} stroke={dividerColor} strokeWidth={strokeWidth} />
            <line x1={1} y1={height / 3} x2={width - 1} y2={height / 3} stroke={dividerColor} strokeWidth={strokeWidth} />
            <line x1={1} y1={(height * 2) / 3} x2={width - 1} y2={(height * 2) / 3} stroke={dividerColor} strokeWidth={strokeWidth} />
          </>
        );

      case '6_left_tall_five_grid':
        return (
          <>
            <line x1={width * 0.32} y1={1} x2={width * 0.32} y2={height - 1} stroke={dividerColor} strokeWidth={strokeWidth} />
            <line x1={width * 0.32} y1={height / 2} x2={width - 1} y2={height / 2} stroke={dividerColor} strokeWidth={strokeWidth} />
            <line x1={width * 0.66} y1={1} x2={width * 0.66} y2={height / 2} stroke={dividerColor} strokeWidth={strokeWidth} />
            <line x1={width * 0.54} y1={height / 2} x2={width * 0.54} y2={height - 1} stroke={dividerColor} strokeWidth={strokeWidth} />
            <line x1={width * 0.77} y1={height / 2} x2={width * 0.77} y2={height - 1} stroke={dividerColor} strokeWidth={strokeWidth} />
          </>
        );

      case '7_three_top_four_bottom':
        return (
          <>
            <line x1={1} y1={height / 2} x2={width - 1} y2={height / 2} stroke={dividerColor} strokeWidth={strokeWidth} />
            <line x1={width / 3} y1={1} x2={width / 3} y2={height / 2} stroke={dividerColor} strokeWidth={strokeWidth} />
            <line x1={(width * 2) / 3} y1={1} x2={(width * 2) / 3} y2={height / 2} stroke={dividerColor} strokeWidth={strokeWidth} />
            <line x1={width / 4} y1={height / 2} x2={width / 4} y2={height - 1} stroke={dividerColor} strokeWidth={strokeWidth} />
            <line x1={width / 2} y1={height / 2} x2={width / 2} y2={height - 1} stroke={dividerColor} strokeWidth={strokeWidth} />
            <line x1={(width * 3) / 4} y1={height / 2} x2={(width * 3) / 4} y2={height - 1} stroke={dividerColor} strokeWidth={strokeWidth} />
          </>
        );

      case '7_four_top_three_bottom':
        return (
          <>
            <line x1={1} y1={height / 2} x2={width - 1} y2={height / 2} stroke={dividerColor} strokeWidth={strokeWidth} />
            <line x1={width / 4} y1={1} x2={width / 4} y2={height / 2} stroke={dividerColor} strokeWidth={strokeWidth} />
            <line x1={width / 2} y1={1} x2={width / 2} y2={height / 2} stroke={dividerColor} strokeWidth={strokeWidth} />
            <line x1={(width * 3) / 4} y1={1} x2={(width * 3) / 4} y2={height / 2} stroke={dividerColor} strokeWidth={strokeWidth} />
            <line x1={width / 3} y1={height / 2} x2={width / 3} y2={height - 1} stroke={dividerColor} strokeWidth={strokeWidth} />
            <line x1={(width * 2) / 3} y1={height / 2} x2={(width * 2) / 3} y2={height - 1} stroke={dividerColor} strokeWidth={strokeWidth} />
          </>
        );

      case '7_left_tall_six_grid':
        return (
          <>
            <line x1={width * 0.28} y1={1} x2={width * 0.28} y2={height - 1} stroke={dividerColor} strokeWidth={strokeWidth} />
            <line x1={width * 0.28} y1={height / 2} x2={width - 1} y2={height / 2} stroke={dividerColor} strokeWidth={strokeWidth} />
            <line x1={width * 0.52} y1={1} x2={width * 0.52} y2={height - 1} stroke={dividerColor} strokeWidth={strokeWidth} />
            <line x1={width * 0.76} y1={1} x2={width * 0.76} y2={height - 1} stroke={dividerColor} strokeWidth={strokeWidth} />
          </>
        );

      case '8_grid_4x2':
        return (
          <>
            <line x1={1} y1={height / 2} x2={width - 1} y2={height / 2} stroke={dividerColor} strokeWidth={strokeWidth} />
            <line x1={width / 4} y1={1} x2={width / 4} y2={height - 1} stroke={dividerColor} strokeWidth={strokeWidth} />
            <line x1={width / 2} y1={1} x2={width / 2} y2={height - 1} stroke={dividerColor} strokeWidth={strokeWidth} />
            <line x1={(width * 3) / 4} y1={1} x2={(width * 3) / 4} y2={height - 1} stroke={dividerColor} strokeWidth={strokeWidth} />
          </>
        );

      case '8_grid_2x4':
        return (
          <>
            <line x1={width / 2} y1={1} x2={width / 2} y2={height - 1} stroke={dividerColor} strokeWidth={strokeWidth} />
            <line x1={1} y1={height / 4} x2={width - 1} y2={height / 4} stroke={dividerColor} strokeWidth={strokeWidth} />
            <line x1={1} y1={height / 2} x2={width - 1} y2={height / 2} stroke={dividerColor} strokeWidth={strokeWidth} />
            <line x1={1} y1={(height * 3) / 4} x2={width - 1} y2={(height * 3) / 4} stroke={dividerColor} strokeWidth={strokeWidth} />
          </>
        );

      case '8_left_two_tall_six_grid':
        return (
          <>
            <line x1={width * 0.22} y1={1} x2={width * 0.22} y2={height - 1} stroke={dividerColor} strokeWidth={strokeWidth} />
            <line x1={width * 0.44} y1={1} x2={width * 0.44} y2={height - 1} stroke={dividerColor} strokeWidth={strokeWidth} />
            <line x1={width * 0.44} y1={height / 2} x2={width - 1} y2={height / 2} stroke={dividerColor} strokeWidth={strokeWidth} />
            <line x1={width * 0.63} y1={1} x2={width * 0.63} y2={height - 1} stroke={dividerColor} strokeWidth={strokeWidth} />
            <line x1={width * 0.81} y1={1} x2={width * 0.81} y2={height - 1} stroke={dividerColor} strokeWidth={strokeWidth} />
          </>
        );

      default:
        return null;
    }
  };

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: 'block', flexShrink: 0 }}
    >
      <rect
        x="0.75"
        y="0.75"
        width={width - 1.5}
        height={height - 1.5}
        rx="2.5"
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={isSelected ? '1.5' : '1'}
      />
      {renderDividers()}
    </svg>
  );
};
