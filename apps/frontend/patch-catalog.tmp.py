"""目录页补丁：学科下拉（stats 数据源）+ 游客隐藏勾选列。一次性脚本。"""
import io

p = 'src/routes/catalog/index.tsx'
s = io.open(p, encoding='utf-8').read()

old = '''      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">学科</label>
        <Input
          placeholder="如 computer science"
          defaultValue={search.discipline ?? ''}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              updateSearch({
                discipline: (e.target as HTMLInputElement).value,
                page: 1,
              })
            }
          }}
        />'''
new = '''      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">学科</label>
        <Select
          value={search.discipline ?? 'all'}
          onValueChange={(v) =>
            updateSearch({ discipline: v === 'all' ? undefined : v, page: 1 })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部学科</SelectItem>
            {(facetDisciplines.length > 0
              ? facetDisciplines
              : search.discipline
                ? [search.discipline]
                : []
            ).map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>'''
if old not in s:
    # 首轮已应用过？检查新结构是否已在
    assert '全部学科' in s, 'discipline anchor missing'
    print('discipline dropdown already applied')
else:
    s = s.replace(old, new)
    print('discipline dropdown applied')

old2 = '''}: {
  search: CatalogSearch
  updateSearch: (patch: Partial<CatalogSearch>) => void
  className: string
}) {
  return ('''
new2 = '''}: {
  search: CatalogSearch
  updateSearch: (patch: Partial<CatalogSearch>) => void
  className: string
}) {
  const { data: stats } = useCatalogStats()
  const facetDisciplines = Object.keys(stats?.by_discipline ?? {})
  return ('''
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('stats hook wired')
else:
    assert 'useCatalogStats()' in s or 'facetDisciplines' in s
    print('stats hook already wired')

if "useCatalogStats, useResources } from '@/hooks/api/use-modules'" in s:
    print('import already ok')
elif "import { exportResources, useResources } from '@/hooks/api/use-modules'" in s:
    s = s.replace("import { exportResources, useResources } from '@/hooks/api/use-modules'",
                  "import { exportResources, useCatalogStats, useResources } from '@/hooks/api/use-modules'")
    print('import patched')

# 游客隐藏勾选列
s = s.replace('  const { isAdmin } = useAuth()', '  const { isAdmin, isAuthenticated } = useAuth()')
old_sel = '''                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label="全选"
                    />
                  </TableHead>
                  <TableHead>标题</TableHead>'''
new_sel = '''                <TableRow>
                  {isAuthenticated && (
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                        aria-label="全选"
                      />
                    </TableHead>
                  )}
                  <TableHead>标题</TableHead>'''
if old_sel in s:
    s = s.replace(old_sel, new_sel)
    print('guest th hidden')
else:
    print('guest th already hidden')

old_td = '''                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(r.id)}
                          onChange={() => toggleOne(r.id)}
                          aria-label={`选择 ${r.title}`}
                        />
                      </TableCell>'''
new_td = '''                      {isAuthenticated && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(r.id)}
                            onChange={() => toggleOne(r.id)}
                            aria-label={`选择 ${r.title}`}
                          />
                        </TableCell>
                      )}'''
if old_td in s:
    s = s.replace(old_td, new_td)
    print('guest td hidden')
else:
    print('guest td already hidden')

io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('catalog done')
