import { previewTransaction } from './preview-store.js'
import { normalizeFood } from '../src/features/food/model.js'
import { dayKey } from '../src/features/coupons/model.js'

// Local preview examples only. A completed seed never resurrects deleted examples or replaces edits.
export async function seedFoodPreview() {
  await previewTransaction(state => {
    if (state.foodPreviewSeedComplete) return null
    const main = state.records.main?.value
    if (!main) throw Error('请先初始化家庭预览记录。')
    const today = dayKey()
    const day = offset => new Date(Date.parse(`${today}T00:00:00Z`) + offset * 86400000).toISOString().slice(0, 10)
    const make = (id, fields) => normalizeFood({ id, kind: 'place', status: 'want', author: '小悦', notes: '本机预览示例：店名、收藏和用餐体验均为虚构，用于体验操作流程。', createdAt: `${day(-4)}T10:00:00Z`, updatedAt: `${day(-4)}T10:00:00Z`, ...fields })
    const records = [
      make('food-preview-eaves', { title: '檐下小馆', city: '杭州', area: '西湖边', dishes: '桂花糖藕、葱油拌面', reason: '想在散步之后，找个窗边的位置吃顿慢饭。', sourceText: '城市：杭州\n店名：檐下小馆\n想吃：桂花糖藕、葱油拌面\n这是整理收藏的预览示例。', createdAt: `${day(-1)}T10:00:00Z` }),
      make('food-preview-steam', { title: '早起蒸笼', city: '杭州', area: '老街', dishes: '鲜肉小笼、咸豆浆', author: 'Aosen', reason: '找一个不用赶上班的早晨，一起出门吃早餐。', createdAt: `${day(-2)}T10:00:00Z` }),
      make('food-preview-river', { title: '河畔炭火小院', city: '杭州', area: '运河边', dishes: '炭烤牛肉、烤菌菇', reason: '下班想吃点热乎的，记得先问一下是否要排队。', createdAt: `${day(-3)}T10:00:00Z` }),
      make('food-preview-tea', { title: '一盏茶点', city: '杭州', area: '城西', dishes: '桂花米糕、热茶', author: 'Aosen', reason: '雨天可以坐着聊天的小地方，等一个空闲下午。', createdAt: `${day(-4)}T10:00:00Z` }),
      make('food-preview-shanghai', { title: '弄堂慢食', city: '上海', area: '老城厢', dishes: '红烧肉、荠菜馄饨', reason: '下次周末去上海，留一顿饭给本帮菜。', sourceText: '上海周末想吃的一家小馆，先把名字记下来。' }),
      make('food-preview-bakery', { title: '面包与晨光', city: '上海', area: '梧桐街区', dishes: '黄油可颂、热拿铁', author: 'Aosen', reason: '拍完街景之后，坐下来吃个早餐。' }),
      make('food-preview-chengdu', { title: '巷尾川味', city: '成都', area: '青羊', dishes: '家常豆腐、回锅肉', reason: '去成都时想尝的家常味道，点菜时问问辣度。' }),
      make('food-preview-chengdu-noodle', { title: '一碗热面', city: '成都', area: '玉林', dishes: '豌杂面、冰粉', author: 'Aosen', reason: '不排满行程，午后找家小店随便吃一点。' }),
      make('food-preview-guide', { title: '成都三天，两个人慢慢吃', kind: 'guide', city: '成都', dishes: '小面、川菜、茶馆点心', sourceText: '收藏了一整篇成都吃喝攻略：早餐可以找小面，午后去茶馆坐坐，晚饭想吃家常川菜。还没选定具体店铺，先原样留在这里。', reason: '整篇先收好，出发前再挑真正想去的几家。' }),
      make('food-preview-dish', { title: '想尝一次热腾腾的芋泥麻薯', kind: 'dish', dishes: '芋泥麻薯', reason: '只记住了想吃的味道，还没找到具体小店。' }),
      make('food-preview-visited', { title: '小院砂锅', city: '杭州', area: '城北', dishes: '菌菇鸡汤砂锅', status: 'eaten', visitedOn: day(-3), verdict: 'again', reason: '天冷了想喝热汤。', notes: '两个人分一锅刚好，走出门还觉得暖暖的。\n本机预览示例，店名和体验为虚构。' }),
      make('food-preview-visited-once', { title: '街角甜品屋', city: '上海', dishes: '焦糖布丁', author: 'Aosen', status: 'eaten', visitedOn: day(-15), verdict: 'once', notes: '路过吃一份挺开心，下一次想试别的味道。\n本机预览示例，店名和体验为虚构。' }),
    ]
    main.foodPlaces ||= []
    for (const food of records) if (!main.foodPlaces.some(item => item.id === food.id)) main.foodPlaces.push(food)
    main._familyRevision = (main._familyRevision || 0) + 1
    state.foodPreviewSeedComplete = true
    return null
  })
}
