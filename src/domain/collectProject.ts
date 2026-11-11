export interface ProjectFileRef { id: string; absolutePath: string; relativePath?: string }
export interface CollectedFile { id: string; sourcePath: string; targetPath: string }

export function collectPlan(projectRoot: string, files: ProjectFileRef[]): CollectedFile[] {
  const root = projectRoot.replace(/[\\/]+$/, '')
  return files.map((file) => {
    const normalized = file.absolutePath.replace(/\\/g, '/')
    const rel = file.relativePath?.replace(/\\/g, '/') || normalized.replace(`${root.replace(/\\/g, '/')}/`, '')
    if (!rel || rel.startsWith('/') || rel.split('/').includes('..')) throw new Error(`File ${file.id} cannot be collected with a portable path.`)
    return { id: file.id, sourcePath: file.absolutePath, targetPath: `media/${rel}` }
  })
}

export function relinkById(files: ProjectFileRef[], replacements: Record<string, string>): ProjectFileRef[] {
  return files.map((file) => replacements[file.id] ? { ...file, absolutePath: replacements[file.id] } : file)
}
