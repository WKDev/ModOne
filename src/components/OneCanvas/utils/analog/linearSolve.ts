// 작은 선형계 Ax=b를 부분 피벗 가우스 소거로 푸는 의존성 없는 솔버 (아날로그 DC 해석용)

/**
 * Solve A x = b for x via Gaussian elimination with partial pivoting.
 * A is an n×n matrix (row-major), b length n. Returns x (length n) or null
 * if the system is singular (within tolerance).
 */
export function linearSolve(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  // Work on copies so the caller's matrices are untouched.
  const M = A.map((row) => row.slice());
  const x = b.slice();

  for (let col = 0; col < n; col++) {
    // Partial pivot: largest magnitude in this column at/below the diagonal.
    let pivot = col;
    let best = Math.abs(M[col][col]);
    for (let r = col + 1; r < n; r++) {
      const v = Math.abs(M[r][col]);
      if (v > best) { best = v; pivot = r; }
    }
    if (best < 1e-12) return null; // singular

    if (pivot !== col) {
      [M[col], M[pivot]] = [M[pivot], M[col]];
      [x[col], x[pivot]] = [x[pivot], x[col]];
    }

    // Eliminate below.
    const diag = M[col][col];
    for (let r = col + 1; r < n; r++) {
      const f = M[r][col] / diag;
      if (f === 0) continue;
      for (let c = col; c < n; c++) M[r][c] -= f * M[col][c];
      x[r] -= f * x[col];
    }
  }

  // Back-substitution.
  for (let row = n - 1; row >= 0; row--) {
    let sum = x[row];
    for (let c = row + 1; c < n; c++) sum -= M[row][c] * x[c];
    x[row] = sum / M[row][row];
  }
  return x;
}
