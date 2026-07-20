export const MASTER_STAGE_ID = "master-stage"

/** Índices dos capítulos no MasterScrollStage (Preços fica fora). */
export const MASTER_CHAPTER = {
  features: 0,
  passo2: 1,
  passo3: 2,
  solutions: 3,
  platform: 4,
} as const

export const MASTER_CHAPTER_COUNT = 5

/** Altura de scroll por capítulo (vh) — alinhada ao MasterScrollStage. */
export const MASTER_CHAPTER_VH = 100

export function scrollToMasterChapter(index: number) {
  const container = document.getElementById(MASTER_STAGE_ID)
  if (!container) {
    return
  }

  const clamped = Math.min(
    Math.max(index, 0),
    MASTER_CHAPTER_COUNT - 1,
  )
  const chapterHeight = container.offsetHeight / MASTER_CHAPTER_COUNT
  const top =
    container.getBoundingClientRect().top +
    window.scrollY +
    chapterHeight * clamped

  window.scrollTo({ top, behavior: "smooth" })
}
