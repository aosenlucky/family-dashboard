<template>
  <div class="pt-28 pb-20 min-h-screen">
    <header class="px-4 text-center mb-10">
      <p class="text-[11px] text-apple-blue font-semibold mb-2">Family Trip</p>
      <h1 class="text-3xl md:text-5xl font-semibold tracking-tight text-gray-900 mb-3">一起把假期安排舒服</h1>
      <p class="text-gray-500 text-sm md:text-base max-w-2xl mx-auto font-light leading-relaxed">把收藏的攻略、想住的地方和家人的节奏放在一起，慢慢拼成一趟真正想去的旅行。</p>
    </header>

    <main class="max-w-6xl mx-auto px-4 grid grid-cols-1 xl:grid-cols-[430px_1fr] gap-6 items-stretch">
      <section class="glass-card travel-form-panel rounded-3xl p-6">
        <div class="flex items-center justify-between mb-6">
          <div>
            <p class="text-[11px] text-apple-blue font-semibold mb-1">Trip Notes</p>
            <h2 class="text-xl font-semibold text-gray-900">这次出门的小设定</h2>
          </div>
          <i class="ph ph-sliders-horizontal text-2xl text-gray-700"></i>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <label class="field-label col-span-2">
            <span>目的地</span>
            <input v-model="form.destination" class="apple-input" />
          </label>
          <label class="field-label">
            <span>开始日期</span>
            <input v-model="form.startDate" type="date" class="apple-input" />
          </label>
          <label class="field-label">
            <span>结束日期</span>
            <input v-model="form.endDate" type="date" class="apple-input" />
          </label>
        </div>

        <label class="field-label mt-3">
          <span>酒店名称</span>
          <input v-model="form.hotelArea" class="apple-input" placeholder="输入具体酒店名称" />
        </label>
        <div class="flex flex-wrap gap-2 mb-4">
          <a :href="baiduMapSearchUrl(form.hotelArea)" target="_blank" class="mini-pill" :class="{ 'pointer-events-none opacity-50': !form.hotelArea.trim() }">
            <i class="ph ph-arrow-square-out"></i> 百度地图
          </a>
          <button class="mini-pill" :class="{ 'bg-blue-50 text-apple-blue': useDailyHotels }" @click="useDailyHotels = !useDailyHotels">
            <i class="ph ph-buildings"></i> {{ useDailyHotels ? '按日期设置中' : '多酒店/换酒店' }}
          </button>
        </div>

        <div v-if="useDailyHotels" class="space-y-2 mb-4">
          <div v-for="date in tripDates" :key="date" class="grid grid-cols-[92px_1fr_34px] gap-2 items-center bg-white/45 rounded-2xl p-2">
            <span class="text-[11px] font-semibold text-gray-500">{{ date }}</span>
            <input v-model="dailyHotels[date]" class="apple-input !py-2" :placeholder="form.hotelArea || '默认酒店'" />
            <a :href="baiduMapSearchUrl(dailyHotels[date] || form.hotelArea)" target="_blank" class="w-8 h-8 rounded-full bg-white flex items-center justify-center text-gray-600" :class="{ 'pointer-events-none opacity-40': !(dailyHotels[date] || form.hotelArea).trim() }">
              <i class="ph ph-arrow-square-out"></i>
            </a>
          </div>
        </div>

        <div class="grid grid-cols-3 gap-2 mb-4">
          <div v-for="item in travelerControls" :key="item.key" class="stepper-box">
            <span>{{ item.label }}</span>
            <div>
              <button type="button" :aria-label="`减少${item.label}`" @click="setTraveler(item.key, -1)">-</button>
              <strong>{{ form.travelers[item.key] }}</strong>
              <button type="button" :aria-label="`增加${item.label}`" @click="setTraveler(item.key, 1)">+</button>
            </div>
          </div>
        </div>

        <label class="field-label">
          <span>花费和小顾虑</span>
          <textarea v-model="form.budget" rows="2" class="apple-input resize-y" />
        </label>

        <div class="section-title">走路节奏</div>
        <div class="segmented mb-4">
          <button v-for="item in paceOptions" :key="item.id" :class="{ active: form.pace === item.id }" @click="form.pace = item.id">{{ item.label }}</button>
        </div>

        <div class="section-title">这次想多看点</div>
        <div class="flex flex-wrap gap-2 mb-4">
          <button v-for="item in interestOptions" :key="item" class="chip" :class="{ active: form.interests.includes(item) }" @click="toggleList(form.interests, item)">
            <i v-if="form.interests.includes(item)" class="ph ph-check"></i>{{ item }}
          </button>
        </div>

        <div class="section-title">想先看哪种玩法</div>
        <div class="relative mb-4">
          <button class="variant-trigger" @click="variantMenuOpen = !variantMenuOpen">
            <span>{{ selectedVariantLabel }}</span><i class="ph ph-caret-down"></i>
          </button>
          <div v-if="variantMenuOpen" class="variant-menu">
            <button v-for="item in variantOptions" :key="item.id" class="variant-option" :class="{ active: form.selectedVariants.includes(item.id) }" @click="toggleVariant(item.id)">
              <span><i v-if="form.selectedVariants.includes(item.id)" class="ph ph-check"></i>{{ item.label }}</span>
              <small>{{ item.detail }}</small>
            </button>
          </div>
        </div>

        <label class="field-label">
          <span>已经收藏的攻略</span>
          <textarea v-model="form.strategyText" rows="5" class="apple-input resize-y" placeholder="粘贴小红书攻略、地点清单、餐厅备注、避坑提醒..." />
        </label>

        <div class="section-title">攻略截图</div>
        <label class="upload-box">
          <input type="file" accept="image/*" multiple class="hidden" @change="handleImageUpload" />
          <i class="ph ph-image-square text-lg"></i>
          <span>上传截图或地图</span>
          <small>最多 6 张，单张 4MB 内</small>
        </label>
        <div v-if="strategyImages.length" class="grid grid-cols-3 gap-2 mb-4">
          <div v-for="image in strategyImages" :key="image.id" class="image-thumb">
            <img :src="image.dataUrl" :alt="image.name" />
            <button @click="removeImage(image.id)"><i class="ph ph-trash"></i></button>
          </div>
        </div>

        <label class="field-label">
          <span>参考链接</span>
          <textarea v-model="referenceLinksText" rows="3" class="apple-input resize-y" placeholder="每行一个链接，支持小红书短链解析" />
        </label>

        <label class="field-label">
          <span>想改哪里</span>
          <input v-model="form.feedback" class="apple-input" placeholder="把 Day 2 上午清水寺改成伏见稻荷 / 太累了" />
        </label>

        <div class="summary-box">
          <span>{{ form.travelers.adults }} 成人 · {{ form.travelers.children }} 儿童 · {{ form.travelers.seniors }} 长辈</span>
          <span>酒店：{{ useDailyHotels ? `${hotelStays.length} 天分别设置` : form.hotelArea }}</span>
          <span>版本：{{ selectedVariantLabel }}</span>
          <span>攻略图片：{{ strategyImages.length ? `${strategyImages.length} 张` : '未上传' }}</span>
        </div>

        <div class="flex flex-wrap gap-3 mt-5">
          <button class="primary-btn" :disabled="isLoading || !form.selectedVariants.length" @click="generate(false)">
            <i class="ph ph-sparkle"></i>{{ isLoading ? '生成中...' : form.feedback ? '按想法重新安排' : '帮我安排行程' }}
          </button>
          <button class="secondary-btn" :disabled="isLoading" @click="generate(true)">示例看看</button>
        </div>
        <p v-if="error" class="text-xs text-rose-500 mt-3">{{ error }}</p>
      </section>

      <section class="min-w-0 travel-output-panel">
        <div v-if="!plan" class="empty-travel-card rounded-3xl" :style="{ backgroundImage: `url(${dailyScenery.image})` }">
          <div class="empty-travel-scrim"></div>
          <div class="empty-travel-content">
            <p class="text-[11px] font-semibold mb-3 text-white/80">{{ dailyScenery.place }}</p>
            <h2>{{ dailySlogan.title }}</h2>
            <p>{{ dailySlogan.body }}</p>
            <div class="empty-travel-actions">
              <span><i class="ph ph-calendar-blank"></i>{{ form.startDate }} 出发</span>
              <span><i class="ph ph-map-pin"></i>{{ form.destination || '想去的地方' }}</span>
            </div>
          </div>
        </div>

        <div v-else class="space-y-5">
          <header class="glass-card rounded-3xl overflow-hidden relative min-h-[220px] p-6 flex items-start justify-between gap-4">
            <div class="relative z-10 max-w-md">
              <p class="text-[11px] text-apple-blue font-semibold mb-2">这趟路</p>
              <h2 class="text-2xl md:text-3xl font-semibold text-gray-900">{{ plan.meta.destination }} 旅行安排</h2>
              <p class="text-sm text-gray-500 mt-2">{{ plan.meta.dateRange }}</p>
            </div>
            <img class="absolute right-0 top-0 h-full w-[48%] object-cover opacity-90 hero-mask" :src="activePlan.heroImageUrl" :alt="activePlan.heroImageAlt || activePlan.title" @error="useFamilyBg" />
            <button class="download-btn relative z-10" :disabled="isDownloading" @click="downloadPlanCard">
              <i class="ph ph-download-simple"></i>{{ isDownloading ? '生成图片中' : '下载长图' }}
            </button>
          </header>

          <div class="glass-card rounded-3xl p-4 flex flex-wrap gap-2">
            <span v-for="item in plan.meta.assumptions" :key="item" class="pill-blue">{{ item }}</span>
          </div>

          <div class="glass-card rounded-3xl p-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button v-for="item in plan.plans" :key="item.variant" class="plan-tab" :class="{ active: activePlan.variant === item.variant }" @click="activeVariant = item.variant">
              <span>{{ variantLabel[item.variant] }}</span>
              <small>{{ fatigueLabel(item.totalFatigueLevel) }}</small>
            </button>
          </div>

          <article class="space-y-5">
            <div class="px-1 flex items-start justify-between gap-4">
              <div>
                <h3 class="text-xl font-semibold text-gray-900">{{ activePlan.title }}</h3>
                <p class="text-sm text-gray-500 mt-1 leading-relaxed">{{ activePlan.positioning }}</p>
              </div>
              <span class="fatigue" :class="activePlan.totalFatigueLevel">{{ activePlan.totalFatigueLevel }}</span>
            </div>

            <section v-for="day in activePlan.days" :key="`${activePlan.variant}-${day.day}`" class="glass-card rounded-3xl p-5">
              <div class="flex flex-col md:flex-row md:items-start justify-between gap-3 mb-5">
                <div>
                  <h4 class="font-semibold text-gray-900">Day {{ day.day }} · {{ day.theme }}</h4>
                  <p class="text-xs text-gray-500 mt-1">{{ day.date }} · {{ day.areaFocus }}</p>
                </div>
                <p class="text-sm text-gray-500 leading-relaxed md:text-right max-w-md">{{ day.summary }}</p>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-5 gap-0 overflow-x-auto">
                <div v-for="slot in day.slots" :key="`${day.day}-${slot.timeLabel}-${slot.placeName}`" class="slot-card">
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-apple-blue text-xs font-bold">{{ slot.timeLabel }}</span>
                    <span class="fatigue mini" :class="slot.fatigueLevel">{{ slot.fatigueLevel }}</span>
                  </div>
                  <strong class="block text-sm text-gray-900 mt-3 mb-2 leading-snug">{{ slot.placeName }}</strong>
                  <p class="text-xs text-gray-600 leading-relaxed">{{ slot.reason }}</p>
                  <div class="space-y-1.5 text-[11px] text-gray-500 mt-3">
                    <p><i class="ph ph-clock mr-1"></i>{{ slot.stayMinutes }} 分钟</p>
                    <p><i class="ph ph-camera mr-1"></i>{{ slot.photoTips }}</p>
                    <p><i class="ph ph-fork-knife mr-1"></i>{{ slot.foodTips }}</p>
                    <p><b class="text-gray-800">家庭提醒：</b>{{ slot.familyFriendlyTips }}</p>
                    <p><b class="text-gray-800">交通：</b>{{ slot.transportHint }}</p>
                    <p><b class="text-gray-800">备选：</b>{{ slot.backupPlan }}</p>
                  </div>
                </div>
              </div>
              <footer class="border-t border-white/70 mt-5 pt-4 flex flex-col md:flex-row justify-between gap-2 text-xs text-gray-500">
                <span>{{ day.dailyBudgetHint }}</span><span>{{ day.riskCheck }}</span>
              </footer>
            </section>
          </article>

          <section class="glass-card rounded-3xl p-5">
            <h3 class="font-semibold text-gray-900 mb-3 flex items-center"><i class="ph ph-arrows-clockwise mr-2 text-apple-blue"></i>我帮你调整过的地方</h3>
            <ul class="text-sm text-gray-600 leading-relaxed list-disc pl-5">
              <li v-for="item in [...plan.critique.initialIssues, ...plan.critique.revisionsApplied]" :key="item">{{ item }}</li>
            </ul>
          </section>

          <section class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="glass-card rounded-3xl p-5">
              <h3 class="font-semibold text-gray-900 mb-3 flex items-center"><i class="ph ph-check-circle mr-2 text-apple-blue"></i>这次保留的重点</h3>
              <p class="priority-hint"><i class="ph ph-info"></i>P 表示优先级，P5 最高，P1 最低；不是游览顺序。</p>
              <div class="flex flex-wrap gap-2">
                <span v-for="place in usedCandidates" :key="place.id" class="pill-gray">{{ place.name }} · {{ place.area }} · P{{ place.priority }}</span>
              </div>
            </div>
            <div class="glass-card rounded-3xl p-5">
              <h3 class="font-semibold text-gray-900 mb-3 flex items-center"><i class="ph ph-route mr-2 text-apple-blue"></i>为什么这样走</h3>
              <ul class="decision-list">
                <li v-for="item in routeLogic" :key="item">{{ item }}</li>
              </ul>
            </div>
            <div class="glass-card rounded-3xl p-5">
              <h3 class="font-semibold text-gray-900 mb-3 flex items-center"><i class="ph ph-shield-check mr-2 text-apple-blue"></i>先不安排的事</h3>
              <ul class="decision-list">
                <li v-for="item in rejectedItems" :key="item">{{ item }}</li>
              </ul>
            </div>
          </section>

          <div class="download-stage" aria-hidden="true">
            <div ref="downloadRef" class="download-card">
              <div class="download-bg"></div>
              <div class="download-content">
                <header>
                  <p>AI Family Travel Planner</p>
                  <h2>{{ plan.meta.destination }} · {{ variantLabel[activePlan.variant] }}</h2>
                  <span>{{ plan.meta.dateRange }}</span>
                </header>
                <img class="download-hero" :src="activePlan.heroImageUrl" :alt="activePlan.heroImageAlt || activePlan.title" @error="useFamilyBg" />
                <section class="download-summary">
                  <strong>{{ activePlan.title }}</strong>
                  <p>{{ activePlan.positioning }}</p>
                </section>
                <div class="download-days">
                  <section v-for="day in activePlan.days" :key="`download-${day.day}`">
                    <div class="download-day-head"><b>Day {{ day.day }}</b><span>{{ day.date }} · {{ day.theme }}</span></div>
                    <p>{{ day.summary }}</p>
                    <ul>
                      <li v-for="slot in day.slots" :key="`download-${day.day}-${slot.timeLabel}`">
                        <span>{{ slot.timeLabel }}</span>
                        <div><strong>{{ slot.placeName }}</strong><small>{{ slot.reason }}</small><small>交通：{{ slot.transportHint }}</small></div>
                        <em>{{ slot.stayMinutes }} 分钟</em>
                      </li>
                    </ul>
                    <p class="download-note">{{ day.dailyBudgetHint }} · {{ day.riskCheck }}</p>
                  </section>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { toPng } from 'html-to-image'

const variantOptions = [
  { id: 'classic', label: '经典版', detail: '代表性景点和城市初印象' },
  { id: 'photoFood', label: '拍照美食版', detail: '出片地点、餐厅和咖啡甜品' },
  { id: 'familyRelaxed', label: '家庭轻松版', detail: '少绕路、低疲劳、留休息' }
]
const variantLabel = { classic: '经典版', photoFood: '拍照美食版', familyRelaxed: '家庭轻松版' }
const paceOptions = [{ id: 'relaxed', label: '轻松' }, { id: 'balanced', label: '均衡' }, { id: 'packed', label: '充实' }]
const interestOptions = ['历史文化', '亲子友好', '拍照出片', '本地美食', '自然公园', '博物馆', '购物', '轻徒步']
const travelerControls = [
  { key: 'adults', label: '成人' },
  { key: 'children', label: '儿童' },
  { key: 'seniors', label: '长辈' }
]
const sceneryImages = [
  { place: '山谷清晨', image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=82' },
  { place: '湖边日落', image: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1600&q=82' },
  { place: '森林与远山', image: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1600&q=82' },
  { place: '公路和云', image: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1600&q=82' },
  { place: '水边的风', image: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1600&q=82' },
  { place: '开阔山野', image: 'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=1600&q=82' }
]
const scenerySlogans = [
  { title: '生活不是赶路，是一起看见更大的世界。', body: '把日程留一点空，把心情留一点慢。真正好的旅行，不是把每个地方都走完，而是回来以后还想起那天的风。' },
  { title: '自由有时候很简单，就是今天可以往远处走。', body: '把想去的地方放进地图，也把家人的体力、胃口和小脾气一起放进去。舒服地出门，比完美打卡更重要。' },
  { title: '我们把生活带上路，也把路上的光带回家。', body: '旅行不只是换一个地方睡觉，它会让普通的一天多一点开阔，也让一家人的记忆多一个共同坐标。' }
]
const maxImages = 6
const maxImageSize = 4 * 1024 * 1024

const form = ref({
  destination: '京都',
  startDate: todayString(),
  endDate: todayString(),
  hotelArea: '四条河原町酒店',
  travelers: { adults: 2, children: 0, seniors: 0 },
  budget: '中等偏舒适，每天餐饮和交通控制在合理范围',
  pace: 'balanced',
  interests: ['历史文化', '亲子友好', '本地美食'],
  selectedVariants: ['classic'],
  strategyText: '',
  feedback: ''
})
const useDailyHotels = ref(false)
const dailyHotels = ref({})
const strategyImages = ref([])
const referenceLinksText = ref('')
const variantMenuOpen = ref(false)
const isLoading = ref(false)
const isDownloading = ref(false)
const error = ref('')
const plan = ref(null)
const activeVariant = ref('classic')
const downloadRef = ref(null)

const tripDates = computed(() => enumerateDates(form.value.startDate, form.value.endDate))
const hotelStays = computed(() => buildHotelStays(tripDates.value, form.value.hotelArea, dailyHotels.value, useDailyHotels.value))
const selectedVariantLabel = computed(() => form.value.selectedVariants.map(id => variantLabel[id]).filter(Boolean).join('、'))
const activePlan = computed(() => plan.value?.plans?.find(item => item.variant === activeVariant.value) || plan.value?.plans?.[0])
const allCandidates = computed(() => [...(plan.value?.extractedStrategy?.places || []), ...(plan.value?.extractedStrategy?.restaurants || [])])
const usedCandidates = computed(() => {
  if (!activePlan.value) return []
  const scheduled = new Set(activePlan.value.days.flatMap(day => day.slots.map(slot => slot.placeName)))
  const used = allCandidates.value.filter(place => scheduled.has(place.name)).sort((a, b) => b.priority - a.priority)
  return (used.length ? used : allCandidates.value).slice(0, 6)
})
const routeLogic = computed(() => {
  if (!activePlan.value) return []
  const areaFocus = [...new Set(activePlan.value.days.map(day => day.areaFocus))]
  const rationale = plan.value?.extractedStrategy?.selectionRationale || plan.value?.extractedStrategy?.notes || []
  return [...areaFocus, ...rationale].slice(0, 5)
})
const rejectedItems = computed(() => {
  const rejected = plan.value?.extractedStrategy?.rejectedItems || []
  return rejected.slice(0, 5)
})
const dailyIndex = computed(() => daySeed(todayString()))
const dailyScenery = computed(() => sceneryImages[dailyIndex.value % sceneryImages.length])
const dailySlogan = computed(() => scenerySlogans[dailyIndex.value % scenerySlogans.length])

async function generate(useMock = false) {
  isLoading.value = true
  error.value = ''
  try {
    const response = await fetch('/api/travel-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: sessionStorage.getItem('family_auth_token') || '' },
      body: JSON.stringify({
        ...form.value,
        hotelStays: hotelStays.value,
        strategyImages: strategyImages.value,
        referenceLinks: referenceLinksText.value.split(/\r?\n/).map(item => item.trim()).filter(Boolean),
        previousPlan: form.value.feedback ? plan.value || undefined : undefined,
        useMock
      })
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || '生成失败')
    plan.value = data
    activeVariant.value = data.plans?.[0]?.variant || 'classic'
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    isLoading.value = false
  }
}

function toggleList(list, value) {
  const index = list.indexOf(value)
  if (index >= 0) list.splice(index, 1)
  else list.push(value)
}
function toggleVariant(value) {
  const list = form.value.selectedVariants
  if (list.includes(value) && list.length === 1) return
  toggleList(list, value)
}
function setTraveler(key, delta) {
  form.value.travelers[key] = Math.max(0, Number(form.value.travelers[key] || 0) + delta)
}
async function handleImageUpload(event) {
  const files = Array.from(event.target.files || []).filter(file => file.type.startsWith('image/')).slice(0, maxImages - strategyImages.value.length)
  event.target.value = ''
  if (!files.length) return
  const oversized = files.find(file => file.size > maxImageSize)
  if (oversized) {
    error.value = `${oversized.name} 超过 4MB，请先压缩后再上传。`
    return
  }
  const images = await Promise.all(files.map(fileToStrategyImage))
  strategyImages.value.push(...images)
}
function removeImage(id) {
  strategyImages.value = strategyImages.value.filter(image => image.id !== id)
}
function fileToStrategyImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve({ id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`, name: file.name, mimeType: file.type, dataUrl: String(reader.result) })
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
async function downloadPlanCard() {
  if (!downloadRef.value) return
  isDownloading.value = true
  try {
    const dataUrl = await toPng(downloadRef.value, { cacheBust: true, pixelRatio: 2, backgroundColor: '#f5f5f7' })
    const link = document.createElement('a')
    link.download = `${plan.value.meta.destination}-${variantLabel[activePlan.value.variant]}-行程长图.png`
    link.href = dataUrl
    link.click()
  } finally {
    isDownloading.value = false
  }
}
function useFamilyBg(event) {
  event.currentTarget.src = '/bg.jpg'
}
function baiduMapSearchUrl(query) {
  return `https://map.baidu.com/search/${encodeURIComponent((query || '').trim())}`
}
function todayString() {
  return formatDateInputValue(new Date())
}
function daySeed(value) {
  return value.split('-').reduce((sum, part) => sum + Number(part || 0), 0)
}
function formatDateInputValue(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
function enumerateDates(start, end) {
  if (!start || !end) return []
  const cursor = new Date(`${start}T00:00:00`)
  const last = new Date(`${end}T00:00:00`)
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(last.getTime())) return []
  const days = []
  const step = cursor <= last ? 1 : -1
  while ((step > 0 ? cursor <= last : cursor >= last) && days.length < 30) {
    days.push(formatDateInputValue(cursor))
    cursor.setDate(cursor.getDate() + step)
  }
  return days
}
function buildHotelStays(dates, defaultHotel, dailyMap, useDaily) {
  if (!dates.length) return []
  if (!useDaily) return [{ id: 'default-hotel', startDate: dates[0], endDate: dates[dates.length - 1], name: defaultHotel.trim() }]
  return dates.map(date => ({ id: `hotel-${date}`, startDate: date, endDate: date, name: (dailyMap[date] || defaultHotel).trim() }))
}
function fatigueLabel(value) {
  return value === 'low' ? '低疲劳' : value === 'medium' ? '中等强度' : '高强度'
}
</script>

<style scoped>
.travel-form-panel { height:fit-content; }
.travel-output-panel { min-height:760px; display:flex; flex-direction:column; }
.travel-output-panel > .space-y-5 { width:100%; }
.empty-travel-card { position:relative; flex:1; min-height:760px; overflow:hidden; border:1px solid rgba(255,255,255,.62); background-color:#d8dee8; background-size:cover; background-position:center; box-shadow:0 28px 80px rgba(31,41,55,.18); }
.empty-travel-scrim { position:absolute; inset:0; background:linear-gradient(180deg,rgba(10,18,32,.16),rgba(10,18,32,.26) 34%,rgba(10,18,32,.78)); }
.empty-travel-content { position:absolute; inset:auto 0 0; padding:42px; color:white; }
.empty-travel-content h2 { max-width:620px; margin:0 0 18px; font-size:42px; line-height:1.08; font-weight:700; letter-spacing:0; text-wrap:balance; }
.empty-travel-content p { max-width:560px; margin:0; color:rgba(255,255,255,.84); font-size:15px; line-height:1.8; }
.empty-travel-actions { display:flex; flex-wrap:wrap; gap:10px; margin-top:28px; }
.empty-travel-actions span { display:inline-flex; align-items:center; gap:7px; min-height:36px; padding:0 13px; border:1px solid rgba(255,255,255,.34); border-radius:999px; background:rgba(255,255,255,.16); color:white; font-size:12px; font-weight:800; backdrop-filter:blur(16px); }
.field-label { display:flex; flex-direction:column; gap:7px; margin-bottom:12px; }
.field-label span,.section-title { color:#6b7280; font-size:12px; font-weight:700; }
.apple-input { width:100%; border:1px solid rgba(255,255,255,.78); background:rgba(255,255,255,.68); border-radius:16px; padding:11px 13px; color:#1f2937; outline:none; box-shadow:inset 0 0 0 1px rgba(0,0,0,.04); }
.apple-input:focus { box-shadow:inset 0 0 0 1.5px #0066cc, 0 0 0 4px rgba(0,102,204,.12); background:#fff; }
.mini-pill,.chip,.primary-btn,.secondary-btn,.download-btn { display:inline-flex; align-items:center; justify-content:center; gap:7px; border:0; border-radius:999px; font-weight:700; text-decoration:none; transition:.18s ease; }
.mini-pill { padding:8px 12px; background:rgba(255,255,255,.65); color:#374151; font-size:12px; }
.chip { padding:8px 12px; background:rgba(255,255,255,.65); color:#6b7280; font-size:12px; }
.chip.active { background:#fff; color:#0066cc; box-shadow:0 8px 20px rgba(0,102,204,.1); }
.segmented { display:flex; width:100%; background:rgba(255,255,255,.55); border-radius:18px; padding:4px; }
.segmented button { flex:1; border:0; border-radius:14px; background:transparent; padding:9px 10px; color:#6b7280; font-size:12px; font-weight:800; }
.segmented button.active { background:#fff; color:#0066cc; box-shadow:0 8px 20px rgba(0,102,204,.1); }
.variant-trigger { width:100%; display:flex; align-items:center; justify-content:space-between; border:0; border-radius:18px; background:rgba(255,255,255,.75); padding:13px 14px; font-weight:800; }
.variant-menu { position:absolute; z-index:30; left:0; right:0; top:calc(100% + 8px); display:grid; gap:8px; background:rgba(255,255,255,.94); border:1px solid rgba(255,255,255,.8); border-radius:22px; padding:10px; box-shadow:0 24px 60px rgba(0,0,0,.12); backdrop-filter:blur(18px); }
.variant-option { display:flex; flex-direction:column; align-items:flex-start; gap:4px; border:0; border-radius:18px; background:rgba(255,255,255,.7); padding:12px; text-align:left; }
.variant-option.active { color:#0066cc; background:#fff; }
.variant-option span { display:flex; align-items:center; gap:6px; font-weight:800; }
.variant-option small { color:#6b7280; font-size:12px; }
.upload-box { display:flex; align-items:center; gap:9px; margin:8px 0 12px; padding:13px; border-radius:20px; border:1px dashed rgba(0,102,204,.28); background:rgba(239,246,255,.62); color:#0757a8; font-size:12px; font-weight:800; cursor:pointer; }
.upload-box small { margin-left:auto; color:#6b7280; }
.image-thumb { position:relative; overflow:hidden; border-radius:16px; background:#fff; }
.image-thumb img { width:100%; aspect-ratio:4/3; object-fit:cover; display:block; }
.image-thumb button { position:absolute; right:6px; bottom:6px; width:26px; height:26px; border:0; border-radius:999px; background:#fff0ee; color:#d92d20; display:flex; align-items:center; justify-content:center; }
.summary-box { display:grid; gap:6px; padding:13px; border-radius:20px; background:rgba(239,246,255,.75); color:#0757a8; font-size:12px; font-weight:800; }
.primary-btn { min-height:42px; padding:0 18px; background:#1f2937; color:white; }
.secondary-btn { min-height:42px; padding:0 18px; background:rgba(255,255,255,.72); color:#1f2937; }
.primary-btn:disabled,.secondary-btn:disabled,.download-btn:disabled { opacity:.55; cursor:not-allowed; }
.stepper-box { background:rgba(255,255,255,.58); border-radius:18px; padding:10px; }
.stepper-box span { color:#6b7280; font-size:12px; font-weight:700; display:block; margin-bottom:8px; }
.stepper-box div { display:flex; align-items:center; justify-content:space-between; gap:6px; }
.stepper-box button { width:28px; height:28px; border:0; border-radius:999px; background:#fff; font-weight:900; }
.stepper-box strong { min-width:20px; text-align:center; }
.hero-mask { mask-image:linear-gradient(to left,#000 58%,transparent); }
.download-btn { min-height:38px; padding:0 14px; background:#1f2937; color:white; font-size:12px; box-shadow:0 12px 28px rgba(0,0,0,.16); }
.pill-blue,.pill-gray { border-radius:999px; padding:7px 10px; font-size:12px; font-weight:800; }
.pill-blue { background:#eff6ff; color:#0757a8; }
.pill-gray { background:rgba(255,255,255,.72); color:#1f2937; }
.plan-tab { display:flex; align-items:center; justify-content:space-between; border:0; border-radius:18px; padding:13px 15px; background:rgba(255,255,255,.58); color:#6b7280; }
.plan-tab.active { background:#1f2937; color:white; }
.plan-tab span { font-weight:900; }
.plan-tab small { opacity:.72; font-size:11px; }
.fatigue { border-radius:999px; padding:7px 10px; font-size:10px; font-weight:900; text-transform:uppercase; flex:none; }
.fatigue.mini { padding:5px 8px; }
.fatigue.low { background:#eaf8f1; color:#12805c; }
.fatigue.medium { background:#fff4df; color:#a56315; }
.fatigue.high { background:#fff0ee; color:#d92d20; }
.slot-card { min-width:168px; border-left:1px solid rgba(0,0,0,.08); padding:4px 15px 0; }
.slot-card:first-child { border-left:0; padding-left:0; }
.priority-hint { display:flex; align-items:center; gap:5px; margin:0 0 12px; color:#6b7280; font-size:12px; font-weight:800; }
.decision-list { margin:0; padding-left:18px; color:#6b7280; font-size:13px; line-height:1.65; }
.download-stage { position:fixed; top:0; left:-12000px; width:1080px; pointer-events:none; }
.download-card { position:relative; overflow:hidden; width:1080px; min-height:1440px; background:#f5f5f7; padding:64px; color:#1d1d1f; }
.download-bg,.download-card::after { position:absolute; inset:0; content:''; }
.download-bg { background:url('/bg.jpg') center/cover; filter:blur(22px) saturate(1.05) brightness(1.04); transform:scale(1.08); }
.download-card::after { background:rgba(245,245,247,.56); }
.download-content { position:relative; z-index:1; min-height:1312px; border:1px solid rgba(255,255,255,.74); border-radius:48px; background:rgba(255,255,255,.78); box-shadow:0 36px 110px rgba(0,0,0,.16); padding:54px; }
.download-content header p { color:#0066cc; font-size:18px; font-weight:900; margin-bottom:12px; }
.download-content header h2 { max-width:800px; margin:0 0 12px; font-size:58px; line-height:1.05; }
.download-content header span { color:#6b7280; font-size:22px; font-weight:800; }
.download-hero { display:block; width:100%; height:280px; margin:34px 0 0; border-radius:34px; object-fit:cover; box-shadow:0 24px 60px rgba(0,0,0,.14); }
.download-summary { margin:42px 0 28px; border-radius:32px; background:rgba(239,246,255,.82); padding:28px; }
.download-summary strong { display:block; margin-bottom:10px; font-size:28px; }
.download-summary p,.download-days p { color:#6b7280; font-size:18px; line-height:1.55; }
.download-days { display:grid; gap:22px; }
.download-days section { border-radius:30px; background:rgba(255,255,255,.74); padding:28px; }
.download-day-head { display:flex; align-items:baseline; justify-content:space-between; gap:18px; }
.download-day-head b { font-size:24px; }
.download-day-head span { color:#0066cc; font-size:18px; font-weight:900; }
.download-days ul { display:grid; gap:12px; margin:0; padding:0; list-style:none; }
.download-days li { display:grid; grid-template-columns:76px 1fr 92px; gap:12px; align-items:start; border-top:1px solid rgba(0,0,0,.07); padding-top:12px; }
.download-days li span { color:#6b7280; font-size:15px; }
.download-days li strong { display:block; margin-bottom:5px; font-size:18px; }
.download-days li small { display:block; color:#6b7280; font-size:14px; line-height:1.45; }
.download-days li em { color:#86868b; font-size:15px; font-style:normal; text-align:right; }
.download-note { border-top:1px solid rgba(0,0,0,.07); padding-top:14px; font-weight:700; }
@media (max-width:768px) {
  .travel-output-panel { min-height:auto; }
  .empty-travel-card { min-height:560px; }
  .empty-travel-content { padding:28px; }
  .empty-travel-content h2 { font-size:30px; }
  .hero-mask { position:relative; width:100%; height:180px; border-radius:22px; mask-image:none; }
  .slot-card { border-left:0; border-top:1px solid rgba(0,0,0,.08); padding:14px 0; }
  .slot-card:first-child { border-top:0; }
}
</style>
