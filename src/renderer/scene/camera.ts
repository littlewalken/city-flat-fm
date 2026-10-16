export type ObjectId = 'turntable' | 'crate' | 'tv' | 'lamp'
export type ZoomTarget = Exclude<ObjectId, 'lamp'>

/** Which object the camera is focused on (null = the whole room). */
export class Camera {
  private current: ZoomTarget | null = null

  constructor(private onChange: (target: ZoomTarget | null) => void) {}

  target(): ZoomTarget | null {
    return this.current
  }

  zoomTo(t: ZoomTarget): void {
    if (this.current === t) return
    this.current = t
    this.onChange(t)
  }

  back(): void {
    if (this.current === null) return
    this.current = null
    this.onChange(null)
  }
}
