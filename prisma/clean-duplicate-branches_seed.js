// prisma/clean-duplicate-branches.js
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function cleanDuplicateBranches_seed() {
    console.log('Cleaning duplicate industry branches...')

    // اول branchهای با name نامعتبر رو پاک کن
    console.log('Cleaning invalid branches...')
    await prisma.industryBranch.deleteMany({
        where: {
            OR: [
                { name: "انتخاب کنید ..." },
                { name: "" },
                { name: null }
            ]
        }
    })

    // پیدا کردن و پاک کردن branches با name تکراری
    const allBranches = await prisma.industryBranch.findMany({
        include: {
            children: true,
            industries: true
        },
        orderBy: { created_at: 'asc' }
    })

    // گروه‌بندی بر اساس name
    const branchesByName = {}
    allBranches.forEach(branch => {
        if (!branchesByName[branch.name]) {
            branchesByName[branch.name] = []
        }
        branchesByName[branch.name].push(branch)
    })

    // برای هر name تکراری
    for (const [name, branches] of Object.entries(branchesByName)) {
        if (branches.length > 1) {
            console.log(`Cleaning duplicates for name: ${name} (${branches.length} duplicates)`)

            // اولین branch رو نگه دار (قدیمی‌ترین)
            const keeper = branches[0]
            const toDelete = branches.slice(1)

            for (const branch of toDelete) {
                console.log(`Processing branch to delete: ${branch.id} - ${branch.name}`)

                // 1. industries رو به branch اصلی منتقل کن
                if (branch.industries.length > 0) {
                    console.log(`Transferring ${branch.industries.length} industries to keeper branch...`)
                    await prisma.industry.updateMany({
                        where: { industry_branch_id: branch.id },
                        data: { industry_branch_id: keeper.id }
                    })
                }

                // 2. childrenها رو به branch اصلی منتقل کن
                if (branch.children.length > 0) {
                    console.log(`Transferring ${branch.children.length} children to keeper branch...`)
                    await prisma.industryBranch.updateMany({
                        where: { parentId: branch.id },
                        data: { parentId: keeper.id }
                    })
                }

                // 3. حالا branch رو پاک کن
                await prisma.industryBranch.delete({
                    where: { id: branch.id }
                })
                console.log(`Deleted branch with id: ${branch.id}`)
            }
        }
    }

    // همین کار رو برای code هم انجام بده
    const branchesByCode = {}
    const remainingBranches = await prisma.industryBranch.findMany({
        include: {
            children: true,
            industries: true
        },
        orderBy: { created_at: 'asc' }
    })

    remainingBranches.forEach(branch => {
        if (!branchesByCode[branch.code]) {
            branchesByCode[branch.code] = []
        }
        branchesByCode[branch.code].push(branch)
    })

    for (const [code, branches] of Object.entries(branchesByCode)) {
        if (branches.length > 1) {
            console.log(`Cleaning duplicates for code: ${code} (${branches.length} duplicates)`)

            const keeper = branches[0]
            const toDelete = branches.slice(1)

            for (const branch of toDelete) {
                console.log(`Processing branch to delete: ${branch.id} - ${branch.code}`)

                // industries رو منتقل کن
                if (branch.industries.length > 0) {
                    console.log(`Transferring ${branch.industries.length} industries to keeper branch...`)
                    await prisma.industry.updateMany({
                        where: { industry_branch_id: branch.id },
                        data: { industry_branch_id: keeper.id }
                    })
                }

                // childrenها رو منتقل کن
                if (branch.children.length > 0) {
                    console.log(`Transferring ${branch.children.length} children to keeper branch...`)
                    await prisma.industryBranch.updateMany({
                        where: { parentId: branch.id },
                        data: { parentId: keeper.id }
                    })
                }

                // branch رو پاک کن
                await prisma.industryBranch.delete({
                    where: { id: branch.id }
                })
                console.log(`Deleted branch with id: ${branch.id}`)
            }
        }
    }

    console.log('Duplicate cleaning completed!')

    // بررسی نهایی
    const finalCount = await prisma.industryBranch.count()
    console.log(`Total branches after cleaning: ${finalCount}`)

    // بررسی unique constraints
    const uniqueNameCheck = await prisma.industryBranch.groupBy({
        by: ['name'],
        _count: {
            name: true
        },
        having: {
            name: {
                _count: {
                    gt: 1
                }
            }
        }
    })

    const uniqueCodeCheck = await prisma.industryBranch.groupBy({
        by: ['code'],
        _count: {
            code: true
        },
        having: {
            code: {
                _count: {
                    gt: 1
                }
            }
        }
    })

    console.log(`Remaining name duplicates: ${uniqueNameCheck.length}`)
    console.log(`Remaining code duplicates: ${uniqueCodeCheck.length}`)
}

cleanDuplicateBranches_seed()
    .catch(console.error)
    .finally(() => prisma.$disconnect())