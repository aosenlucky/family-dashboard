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

        <div v-if="isHistoryLoading || travelHistory.length" class="history-box">
          <div class="flex items-center justify-between gap-3 mb-3">
            <div>
              <p class="text-[11px] text-apple-blue font-semibold">Saved Trips</p>
              <h3>{{ isHistoryLoading ? '正在同步历史' : '之前保存的行程' }}</h3>
            </div>
            <button v-if="travelHistory.length" type="button" class="mini-pill" :disabled="isSavingHistory" @click="clearHistory">清空</button>
          </div>
          <div class="history-list">
            <div v-for="item in travelHistory" :key="item.id" class="history-item">
              <button type="button" @click="openHistoryPlan(item)">
                <span>{{ item.destination }}</span>
                <small>{{ item.dateRange }}</small>
              </button>
              <button type="button" class="history-delete" :disabled="deletingHistoryId === item.id" :aria-label="`删除${item.destination}行程`" @click.stop="deleteHistoryItem(item)">
                <i class="ph ph-trash"></i>
              </button>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-3">
          <label class="field-label col-span-2">
            <span>目的地</span>
            <input v-model="form.destination" class="apple-input" />
          </label>
          <div class="field-label">
            <span>出发和回来</span>
            <button type="button" class="date-range-trigger" @click="datePickerOpen = !datePickerOpen">
              <span><b>出发</b>{{ formatDisplayDate(form.startDate) }}</span>
              <i class="ph ph-arrow-right"></i>
              <span><b>回来</b>{{ formatDisplayDate(form.endDate) }}</span>
            </button>
            <div v-if="datePickerOpen" class="date-picker-panel">
              <div class="date-picker-head">
                <button type="button" aria-label="上个月" @click="moveCalendar(-1)"><i class="ph ph-caret-left"></i></button>
                <strong>{{ calendarTitle }}</strong>
                <button type="button" aria-label="下个月" @click="moveCalendar(1)"><i class="ph ph-caret-right"></i></button>
              </div>
              <div class="date-week-row">
                <span v-for="day in weekDays" :key="day">{{ day }}</span>
              </div>
              <div class="date-grid">
                <button
                  v-for="day in calendarDays"
                  :key="day.key"
                  type="button"
                  :class="day.className"
                  :disabled="day.disabled"
                  @click="pickDate(day.value)"
                >
                  {{ day.label }}
                </button>
              </div>
              <p class="date-picker-hint">{{ datePickingStep === 'start' ? '先点出发日期，再点回来日期。' : '再点一次回来日期，就完成啦。' }}</p>
            </div>
          </div>
        </div>

        <label class="field-label mt-3">
          <span>酒店名称</span>
          <input v-model="form.hotelArea" class="apple-input" placeholder="输入具体酒店名称" />
        </label>
        <div class="flex flex-wrap gap-2 mb-4">
          <button class="mini-pill" :class="{ 'bg-blue-50 text-apple-blue': useDailyHotels }" @click="useDailyHotels = !useDailyHotels">
            <i class="ph ph-buildings"></i> {{ useDailyHotels ? '按日期设置中' : '多酒店/换酒店' }}
          </button>
        </div>

        <div v-if="useDailyHotels" class="space-y-2 mb-4">
          <div v-for="date in tripDates" :key="date" class="grid grid-cols-[92px_1fr] gap-2 items-center bg-white/45 rounded-2xl p-2">
            <span class="text-[11px] font-semibold text-gray-500">{{ date }}</span>
            <input v-model="dailyHotels[date]" class="apple-input !py-2" :placeholder="form.hotelArea || '默认酒店'" />
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
          <span>收藏的攻略和参考链接</span>
          <textarea v-model="form.strategyText" rows="7" class="apple-input resize-y" placeholder="粘贴你收藏的攻略、地点清单、餐厅备注、避坑提醒；也可以直接放小红书/网页链接。" />
        </label>

        <label class="field-label">
          <span>想改哪里</span>
          <input v-model="form.feedback" class="apple-input" placeholder="把 Day 2 上午清水寺改成伏见稻荷 / 太累了" />
        </label>

        <div class="summary-box">
          <span>{{ form.travelers.adults }} 成人 · {{ form.travelers.children }} 儿童 · {{ form.travelers.seniors }} 长辈</span>
          <span>酒店：{{ useDailyHotels ? `${hotelStays.length} 天分别设置` : form.hotelArea }}</span>
          <span>版本：{{ selectedVariantLabel }}</span>
          <span>攻略来源：{{ extractLinksFromText(form.strategyText).length ? '文字 + 链接' : form.strategyText.trim() ? '文字' : '未填写' }}</span>
        </div>

        <div class="flex flex-wrap gap-3 mt-5">
          <button class="primary-btn" :disabled="isLoading || !form.selectedVariants.length" @click="generate(false)">
            <i class="ph ph-sparkle"></i>{{ isLoading ? '生成中...' : form.feedback ? '按想法重新安排' : '帮我安排行程' }}
          </button>
          <button class="secondary-btn" :disabled="isLoading" @click="generate(true)">示例看看</button>
        </div>
        <div v-if="isLoading" class="loading-note">
          <i class="ph ph-circle-notch"></i> 正在认真安排行程，通常需要 20-50 秒。页面可以停在这里等一会儿。
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
          <header class="glass-card result-hero-card rounded-3xl overflow-hidden relative min-h-[220px] p-6 flex items-start justify-between gap-4">
            <div class="result-hero-copy relative z-10 max-w-md">
              <p class="text-[11px] text-apple-blue font-semibold mb-2">这趟路</p>
              <h2 class="text-2xl md:text-3xl font-semibold text-gray-900">{{ plan.meta.destination }} 旅行安排</h2>
              <p class="text-sm text-gray-500 mt-2">{{ plan.meta.dateRange }}</p>
            </div>
            <img class="result-hero-image absolute right-0 top-0 h-full w-[48%] object-cover opacity-90 hero-mask" :src="safeTravelImageUrl(activePlan.heroImageUrl)" :alt="activePlan.heroImageAlt || activePlan.title" crossorigin="anonymous" @error="useFamilyBg" />
            <button class="download-btn result-download-btn relative z-10" :disabled="isDownloading" @click="downloadPlanCard">
              <i class="ph ph-download-simple"></i>{{ isDownloading ? '生成图片中' : '下载长图' }}
            </button>
          </header>

          <button class="mobile-download-btn" :disabled="isDownloading" @click="downloadPlanCard">
            <i class="ph ph-download-simple"></i>{{ isDownloading ? '正在生成长图' : '导出这份行程长图' }}
          </button>

          <div class="glass-card rounded-3xl p-4 flex flex-wrap gap-2">
            <span v-for="item in plan.meta.assumptions" :key="item" class="pill-blue">{{ item }}</span>
          </div>

          <div v-if="hotelStays.length" class="hotel-map-card glass-card rounded-3xl p-4">
            <div>
              <p>住在哪里</p>
              <h3>按当天酒店来安排出发和回程</h3>
            </div>
            <div class="hotel-map-list">
              <a v-for="stay in hotelStays" :key="stay.id" :href="baiduMapSearchUrl(stay.name, plan.meta.destination)" target="_blank" rel="noopener noreferrer" :class="{ disabled: !stay.name }">
                <span>{{ stay.startDate === stay.endDate ? stay.startDate : `${stay.startDate} 至 ${stay.endDate}` }}</span>
                <strong>{{ stay.name || '未填写酒店' }}</strong>
                <i class="ph ph-arrow-square-out"></i>
              </a>
            </div>
          </div>

          <section v-if="plan.weather" class="weather-card glass-card rounded-3xl p-5">
            <div class="weather-card-head">
              <div>
                <p>天气和出门提醒</p>
                <h3>{{ plan.weather.summary }}</h3>
              </div>
              <span>{{ plan.weather.source || 'Open-Meteo' }}</span>
            </div>
            <div v-if="plan.weather.days?.length" class="weather-days">
              <div v-for="day in plan.weather.days" :key="day.date">
                <strong>{{ formatDisplayDate(day.date) }}</strong>
                <span>{{ day.condition }}</span>
                <small>{{ day.temperatureMin }}°C - {{ day.temperatureMax }}°C · 降雨 {{ day.precipitationProbability }}%</small>
              </div>
            </div>
            <ul class="weather-advice">
              <li v-for="item in plan.weather.advice" :key="item">{{ item }}</li>
            </ul>
          </section>

          <div class="glass-card rounded-3xl p-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button v-for="item in plan.plans" :key="item.variant" class="plan-tab" :class="{ active: activePlan.variant === item.variant }" @click="activeVariant = item.variant">
              <span>{{ variantLabel[item.variant] }}</span>
              <small>{{ fatigueLabel(item.totalFatigueLevel) }}</small>
            </button>
          </div>

          <article class="space-y-5">
            <div class="active-plan-heading px-1">
              <div>
                <h3>{{ activePlan.title }}</h3>
                <p>{{ activePlan.positioning }}</p>
              </div>
              <div class="active-plan-badges">
                <span class="variant-badge">{{ variantLabel[activePlan.variant] }}</span>
                <span class="fatigue" :class="activePlan.totalFatigueLevel">{{ fatigueLabel(activePlan.totalFatigueLevel) }}</span>
              </div>
            </div>

            <section v-for="day in activePlan.days" :key="`${activePlan.variant}-${day.day}`" class="glass-card rounded-3xl p-5">
              <div class="flex flex-col md:flex-row md:items-start justify-between gap-3 mb-5">
                <div>
                  <h4 class="font-semibold text-gray-900">Day {{ day.day }} · {{ day.theme }}</h4>
                  <p class="text-xs text-gray-500 mt-1">{{ day.date }} · {{ day.areaFocus }}</p>
                </div>
                <p class="text-sm text-gray-500 leading-relaxed md:text-right max-w-md">{{ day.summary }}</p>
              </div>
              <div class="slots-list">
                <div v-for="slot in day.slots" :key="`${day.day}-${slot.timeLabel}-${slot.placeName}`" class="slot-card">
                  <div class="slot-time">
                    <span>{{ slot.timeLabel }}</span>
                    <em>{{ slot.stayMinutes }} 分钟</em>
                  </div>
                  <div class="slot-main">
                    <div class="slot-title-row">
                      <strong>{{ slot.placeName }}</strong>
                      <span class="fatigue mini" :class="slot.fatigueLevel">{{ fatigueLabel(slot.fatigueLevel) }}</span>
                    </div>
                    <p>{{ slot.reason }}</p>
                    <div class="slot-detail-grid">
                      <span><i class="ph ph-camera"></i>{{ slot.photoTips }}</span>
                      <span><i class="ph ph-fork-knife"></i>{{ slot.foodTips }}</span>
                      <span><b>家庭提醒：</b>{{ slot.familyFriendlyTips }}</span>
                      <span><b>交通：</b>{{ slot.transportHint }}</span>
                      <span><b>备选：</b>{{ slot.backupPlan }}</span>
                    </div>
                  </div>
                </div>
              </div>
              <footer class="border-t border-white/70 mt-5 pt-4 flex flex-col md:flex-row justify-between gap-2 text-xs text-gray-500">
                <span>{{ day.dailyBudgetHint }}</span><span>{{ day.riskCheck }}</span>
              </footer>
            </section>
          </article>

          <div class="result-actions glass-card rounded-3xl p-4">
            <div>
              <p>确认后会同步到云端历史</p>
              <span v-if="saveStatus">{{ saveStatus }}</span>
              <span v-else>行程满意后再保存，电脑和手机都能从历史里打开。</span>
            </div>
            <button class="save-history-btn" :disabled="isSavingHistory" @click="saveCurrentPlan">
              <i class="ph ph-check-circle"></i>{{ isSavingHistory ? '保存中...' : '这版OK，保存到云端' }}
            </button>
          </div>

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
                <img class="download-hero" :src="safeTravelImageUrl(activePlan.heroImageUrl)" :alt="activePlan.heroImageAlt || activePlan.title" crossorigin="anonymous" @error="useFamilyBg" />
                <section class="download-summary">
                  <strong>{{ activePlan.title }}</strong>
                  <p>{{ variantLabel[activePlan.variant] }} · {{ activePlan.positioning }}</p>
                </section>
                <section v-if="plan.weather" class="download-weather">
                  <strong>{{ plan.weather.summary }}</strong>
                  <p>{{ (plan.weather.advice || []).slice(0, 2).join(' · ') }}</p>
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
import { computed, onMounted, ref } from 'vue'
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
const weekDays = ['日', '一', '二', '三', '四', '五', '六']
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
const transparentPixel = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='

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
const variantMenuOpen = ref(false)
const datePickerOpen = ref(false)
const datePickingStep = ref('start')
const calendarMonth = ref(firstDayOfMonth(new Date()))
const isLoading = ref(false)
const isDownloading = ref(false)
const isSavingHistory = ref(false)
const isHistoryLoading = ref(false)
const deletingHistoryId = ref('')
const error = ref('')
const saveStatus = ref('')
const plan = ref(null)
const activeVariant = ref('classic')
const downloadRef = ref(null)
const travelHistory = ref([])

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
const calendarTitle = computed(() => `${calendarMonth.value.getFullYear()} 年 ${calendarMonth.value.getMonth() + 1} 月`)
const calendarDays = computed(() => buildCalendarDays(calendarMonth.value, form.value.startDate, form.value.endDate))

onMounted(() => {
  loadTravelHistory()
})

async function generate(useMock = false) {
  isLoading.value = true
  error.value = ''
  saveStatus.value = ''
  try {
    const response = await fetch('/api/travel-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: sessionStorage.getItem('family_auth_token') || '' },
      body: JSON.stringify({
        ...form.value,
        hotelStays: hotelStays.value,
        referenceLinks: extractLinksFromText(form.value.strategyText),
        previousPlan: form.value.feedback ? plan.value || undefined : undefined,
        useMock
      })
    })
    const data = await parseApiResponse(response)
    if (!response.ok) throw new Error([data.error, data.detail].filter(Boolean).join(' '))
    plan.value = data
    activeVariant.value = data.plans?.[0]?.variant || 'classic'
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    isLoading.value = false
  }
}

async function parseApiResponse(response) {
  const text = await response.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return {
      error: response.ok ? '服务端返回格式异常。' : `服务端请求失败：${response.status}`,
      detail: text.slice(0, 600)
    }
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
async function downloadPlanCard() {
  if (!downloadRef.value) return
  isDownloading.value = true
  error.value = ''
  try {
    await waitForNextFrame()
    const dataUrl = await withClientTimeout(
      toPng(downloadRef.value, {
        cacheBust: true,
        pixelRatio: isSmallScreen() ? 1.35 : 2,
        backgroundColor: '#f5f5f7',
        imagePlaceholder: transparentPixel,
        skipFonts: true
      }),
      isSmallScreen() ? 18000 : 25000
    )
    const link = document.createElement('a')
    link.download = `${plan.value.meta.destination}-${variantLabel[activePlan.value.variant]}-行程长图.png`
    link.href = dataUrl
    link.click()
  } catch (err) {
    error.value = err instanceof Error ? `导出长图失败：${err.message}` : '导出长图失败，请稍后再试。'
  } finally {
    isDownloading.value = false
  }
}
async function saveCurrentPlan() {
  if (!plan.value || !activePlan.value) return
  isSavingHistory.value = true
  saveStatus.value = ''
  try {
    const item = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      destination: plan.value.meta?.destination || form.value.destination,
      dateRange: plan.value.meta?.dateRange || `${form.value.startDate} 至 ${form.value.endDate}`,
      savedAt: new Date().toISOString(),
      activeVariant: activePlan.value.variant,
      plan: structuredCloneSafe(plan.value),
      form: structuredCloneSafe({
        ...form.value,
        hotelStays: hotelStays.value
      })
    }
    const response = await fetch('/api/travel-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: sessionStorage.getItem('family_auth_token') || '' },
      body: JSON.stringify({ item })
    })
    const data = await parseApiResponse(response)
    if (!response.ok) throw new Error([data.error, data.detail].filter(Boolean).join(' '))
    travelHistory.value = Array.isArray(data.history) ? data.history : [data.item, ...travelHistory.value].filter(Boolean)
    saveStatus.value = '已保存到云端历史，电脑和手机都能看到。'
  } catch (err) {
    saveStatus.value = err instanceof Error ? err.message : '保存失败，请稍后再试。'
  } finally {
    isSavingHistory.value = false
  }
}
function openHistoryPlan(item) {
  if (!item?.plan) return
  plan.value = structuredCloneSafe(item.plan)
  activeVariant.value = item.activeVariant || item.plan.plans?.[0]?.variant || 'classic'
  if (item.form) {
    form.value = {
      ...form.value,
      ...item.form,
      travelers: { ...form.value.travelers, ...(item.form.travelers || {}) },
      interests: Array.isArray(item.form.interests) ? item.form.interests : form.value.interests,
      selectedVariants: Array.isArray(item.form.selectedVariants) ? item.form.selectedVariants : form.value.selectedVariants
    }
    if (item.form.referenceLinksText && !form.value.strategyText.includes(item.form.referenceLinksText)) {
      form.value.strategyText = [form.value.strategyText, item.form.referenceLinksText].filter(Boolean).join('\n')
    }
  }
  error.value = ''
  saveStatus.value = '已打开保存过的行程。'
}
async function deleteHistoryItem(item) {
  if (!item?.id) return
  deletingHistoryId.value = item.id
  saveStatus.value = ''
  try {
    const response = await fetch(`/api/travel-history?id=${encodeURIComponent(item.id)}`, {
      method: 'DELETE',
      headers: { Authorization: sessionStorage.getItem('family_auth_token') || '' }
    })
    const data = await parseApiResponse(response)
    if (!response.ok) throw new Error([data.error, data.detail].filter(Boolean).join(' '))
    travelHistory.value = Array.isArray(data.history) ? data.history : travelHistory.value.filter((history) => history.id !== item.id)
    saveStatus.value = '这条历史行程已删除。'
  } catch (err) {
    saveStatus.value = err instanceof Error ? err.message : '删除失败，请稍后再试。'
  } finally {
    deletingHistoryId.value = ''
  }
}
async function clearHistory() {
  isSavingHistory.value = true
  saveStatus.value = ''
  try {
    const response = await fetch('/api/travel-history', {
      method: 'DELETE',
      headers: { Authorization: sessionStorage.getItem('family_auth_token') || '' }
    })
    const data = await parseApiResponse(response)
    if (!response.ok) throw new Error([data.error, data.detail].filter(Boolean).join(' '))
    travelHistory.value = []
    saveStatus.value = '云端历史记录已清空。'
  } catch (err) {
    saveStatus.value = err instanceof Error ? err.message : '清空失败，请稍后再试。'
  } finally {
    isSavingHistory.value = false
  }
}
async function loadTravelHistory() {
  isHistoryLoading.value = true
  try {
    const response = await fetch('/api/travel-history', {
      headers: { Authorization: sessionStorage.getItem('family_auth_token') || '' }
    })
    const data = await parseApiResponse(response)
    if (!response.ok) throw new Error([data.error, data.detail].filter(Boolean).join(' '))
    travelHistory.value = Array.isArray(data.history) ? data.history : []
  } catch (err) {
    saveStatus.value = err instanceof Error ? err.message : '云端历史读取失败。'
  } finally {
    isHistoryLoading.value = false
  }
}
function structuredCloneSafe(value) {
  try {
    if (typeof structuredClone === 'function') return structuredClone(value)
  } catch {}
  return JSON.parse(JSON.stringify(value))
}
function isSmallScreen() {
  return window.matchMedia?.('(max-width: 768px)').matches
}
function waitForNextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
}
function withClientTimeout(promise, timeoutMs) {
  let timer
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`生成超过 ${Math.round(timeoutMs / 1000)} 秒，请稍后重试或先在电脑端导出。`)), timeoutMs)
    })
  ]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}
function useFamilyBg(event) {
  event.currentTarget.src = '/bg.jpg'
}
function safeTravelImageUrl(url) {
  const value = String(url || '').trim()
  if (!value || /loremflickr\.com/i.test(value)) return dailyScenery.value.image
  return value
}
function baiduMapSearchUrl(query, context = '') {
  const keyword = [context, query].map(item => String(item || '').trim()).filter(Boolean).join(' ')
  const encoded = encodeURIComponent(keyword)
  return `https://map.baidu.com/search/${encoded}/?querytype=s&wd=${encoded}`
}
function extractLinksFromText(text) {
  return [...new Set(String(text || '').match(/https?:\/\/[^\s，。；、]+/g) || [])]
}
function todayString() {
  return formatDateInputValue(new Date())
}
function firstDayOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}
function moveCalendar(delta) {
  calendarMonth.value = new Date(calendarMonth.value.getFullYear(), calendarMonth.value.getMonth() + delta, 1)
}
function pickDate(value) {
  if (datePickingStep.value === 'start') {
    form.value.startDate = value
    if (new Date(`${form.value.endDate}T00:00:00`) < new Date(`${value}T00:00:00`)) form.value.endDate = value
    datePickingStep.value = 'end'
    return
  }
  if (new Date(`${value}T00:00:00`) < new Date(`${form.value.startDate}T00:00:00`)) {
    form.value.endDate = form.value.startDate
    form.value.startDate = value
  } else {
    form.value.endDate = value
  }
  datePickingStep.value = 'start'
  datePickerOpen.value = false
}
function buildCalendarDays(month, startDate, endDate) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const gridStart = new Date(first)
  gridStart.setDate(first.getDate() - first.getDay())
  const today = new Date(`${todayString()}T00:00:00`)
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + index)
    const value = formatDateInputValue(date)
    const inMonth = date.getMonth() === month.getMonth()
    const disabled = date < today
    const isStart = value === startDate
    const isEnd = value === endDate
    const inRange = date > start && date < end
    return {
      key: value,
      value,
      label: date.getDate(),
      disabled,
      className: {
        muted: !inMonth,
        selected: isStart || isEnd,
        'in-range': inRange,
        disabled
      }
    }
  })
}
function formatDisplayDate(value) {
  if (!value) return '未选择'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return `${date.getMonth() + 1}月${date.getDate()}日`
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
.history-box { margin:0 0 18px; padding:15px; border-radius:24px; background:rgba(239,246,255,.72); border:1px solid rgba(255,255,255,.74); }
.history-box h3 { margin:2px 0 0; color:#1f2937; font-size:15px; font-weight:900; }
.history-list { display:grid; gap:8px; }
.history-item { display:grid; grid-template-columns:minmax(0,1fr) 38px; gap:8px; align-items:center; }
.history-item > button:first-child { width:100%; min-width:0; display:flex; align-items:center; justify-content:space-between; gap:12px; border:0; border-radius:16px; background:rgba(255,255,255,.76); padding:11px 12px; text-align:left; color:#1f2937; }
.history-item > button:first-child span { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:13px; font-weight:900; }
.history-item > button:first-child small { flex:none; color:#6b7280; font-size:11px; font-weight:800; }
.history-delete { width:38px; height:38px; border:0; border-radius:999px; background:rgba(255,255,255,.68); color:#9ca3af; display:flex; align-items:center; justify-content:center; }
.history-delete:hover { color:#d92d20; background:#fff0ee; }
.field-label { display:flex; flex-direction:column; gap:7px; margin-bottom:12px; }
.field-label span,.section-title { color:#6b7280; font-size:12px; font-weight:700; }
.apple-input { width:100%; border:1px solid rgba(255,255,255,.78); background:rgba(255,255,255,.68); border-radius:16px; padding:11px 13px; color:#1f2937; outline:none; box-shadow:inset 0 0 0 1px rgba(0,0,0,.04); }
.apple-input:focus { box-shadow:inset 0 0 0 1.5px #0066cc, 0 0 0 4px rgba(0,102,204,.12); background:#fff; }
.date-range-trigger { width:100%; min-height:58px; display:grid; grid-template-columns:1fr 24px 1fr; align-items:center; gap:8px; border:1px solid rgba(255,255,255,.78); border-radius:18px; background:rgba(255,255,255,.68); color:#1f2937; padding:10px 12px; text-align:left; box-shadow:inset 0 0 0 1px rgba(0,0,0,.04); }
.date-range-trigger span { min-width:0; display:grid; gap:3px; color:#1f2937; font-size:15px; font-weight:800; }
.date-range-trigger b { color:#6b7280; font-size:11px; font-weight:800; }
.date-range-trigger i { justify-self:center; color:#0066cc; }
.date-picker-panel { position:relative; z-index:20; margin-top:8px; padding:12px; border:1px solid rgba(255,255,255,.8); border-radius:22px; background:rgba(255,255,255,.92); box-shadow:0 18px 48px rgba(31,41,55,.12); backdrop-filter:blur(18px); }
.date-picker-head { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:10px; }
.date-picker-head button { width:36px; height:36px; border:0; border-radius:999px; background:#f3f4f6; color:#1f2937; display:flex; align-items:center; justify-content:center; }
.date-picker-head strong { font-size:14px; color:#1f2937; }
.date-week-row,.date-grid { display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); gap:5px; }
.date-week-row span { text-align:center; color:#9ca3af; font-size:11px; font-weight:800; padding:4px 0; }
.date-grid button { min-width:0; min-height:36px; border:0; border-radius:12px; background:transparent; color:#1f2937; font-size:13px; font-weight:800; }
.date-grid button.muted { color:#c7cbd1; }
.date-grid button.in-range { background:#eff6ff; color:#0757a8; }
.date-grid button.selected { background:#1f2937; color:white; box-shadow:0 8px 18px rgba(31,41,55,.16); }
.date-grid button.disabled { color:#d1d5db; opacity:.55; cursor:not-allowed; }
.date-picker-hint { margin:10px 2px 0; color:#6b7280; font-size:12px; font-weight:700; }
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
.summary-box { display:grid; gap:6px; padding:13px; border-radius:20px; background:rgba(239,246,255,.75); color:#0757a8; font-size:12px; font-weight:800; }
.loading-note { display:flex; align-items:center; gap:8px; margin-top:12px; border-radius:18px; padding:11px 12px; background:rgba(255,255,255,.72); color:#6b7280; font-size:12px; font-weight:800; line-height:1.5; }
.loading-note i { color:#0066cc; animation:travel-spin 1s linear infinite; }
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
.mobile-download-btn { display:none; width:100%; min-height:48px; align-items:center; justify-content:center; gap:8px; border:0; border-radius:999px; background:#1f2937; color:white; font-size:14px; font-weight:900; box-shadow:0 16px 36px rgba(31,41,55,.18); }
.result-actions { display:flex; align-items:center; justify-content:space-between; gap:16px; border:1px solid rgba(255,255,255,.72); background:rgba(255,255,255,.66); }
.result-actions p { margin:0 0 4px; color:#1f2937; font-size:14px; font-weight:900; }
.result-actions span { display:block; color:#6b7280; font-size:12px; font-weight:700; line-height:1.5; }
.save-history-btn { min-height:42px; flex:none; display:inline-flex; align-items:center; justify-content:center; gap:8px; border:0; border-radius:999px; background:#1f2937; color:#fff; padding:0 16px; font-size:13px; font-weight:900; box-shadow:0 12px 28px rgba(31,41,55,.16); }
.save-history-btn:disabled { opacity:.55; cursor:not-allowed; }
.hotel-map-card { display:grid; grid-template-columns:minmax(0,220px) 1fr; gap:14px; align-items:start; }
.hotel-map-card p { margin:0 0 4px; color:#0066cc; font-size:11px; font-weight:900; }
.hotel-map-card h3 { margin:0; color:#1f2937; font-size:16px; font-weight:900; line-height:1.35; }
.hotel-map-list { display:grid; gap:8px; }
.hotel-map-list a { display:grid; grid-template-columns:118px 1fr 24px; align-items:center; gap:10px; min-height:46px; padding:8px 10px; border-radius:16px; background:rgba(255,255,255,.72); color:#1f2937; text-decoration:none; }
.hotel-map-list a.disabled { pointer-events:none; opacity:.55; }
.hotel-map-list span { color:#6b7280; font-size:11px; font-weight:800; }
.hotel-map-list strong { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:13px; }
.hotel-map-list i { color:#0066cc; justify-self:end; }
.weather-card { display:grid; gap:14px; }
.weather-card-head { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; }
.weather-card-head p { margin:0 0 4px; color:#0066cc; font-size:11px; font-weight:900; }
.weather-card-head h3 { margin:0; color:#1f2937; font-size:17px; line-height:1.4; font-weight:900; }
.weather-card-head > span { flex:none; color:#6b7280; font-size:11px; font-weight:800; }
.weather-days { display:grid; grid-template-columns:repeat(auto-fit,minmax(138px,1fr)); gap:8px; }
.weather-days div { border-radius:18px; background:rgba(255,255,255,.66); padding:11px 12px; display:grid; gap:4px; }
.weather-days strong { color:#1f2937; font-size:13px; }
.weather-days span { color:#0066cc; font-size:12px; font-weight:900; }
.weather-days small { color:#6b7280; font-size:11px; line-height:1.45; }
.weather-advice { margin:0; padding-left:18px; color:#4b5563; font-size:13px; line-height:1.7; }
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
.active-plan-heading { display:flex; align-items:flex-start; justify-content:space-between; gap:14px; }
.active-plan-heading h3 { margin:0; color:#1f2937; font-size:20px; line-height:1.35; font-weight:900; }
.active-plan-heading p { margin:5px 0 0; color:#6b7280; font-size:13px; line-height:1.6; }
.active-plan-badges { flex:none; display:flex; flex-wrap:wrap; justify-content:flex-end; gap:8px; }
.variant-badge { border-radius:999px; background:#1f2937; color:white; padding:7px 10px; font-size:11px; font-weight:900; }
.slots-list { display:grid; gap:12px; }
.slot-card { display:grid; grid-template-columns:86px minmax(0,1fr); gap:16px; padding:16px; border-radius:22px; background:rgba(255,255,255,.58); border:1px solid rgba(255,255,255,.76); box-shadow:inset 0 0 0 1px rgba(0,0,0,.025); }
.slot-time { display:flex; flex-direction:column; gap:7px; align-items:flex-start; }
.slot-time span { color:#0066cc; font-size:13px; font-weight:900; }
.slot-time em { color:#6b7280; font-size:11px; font-style:normal; font-weight:800; }
.slot-main { min-width:0; }
.slot-title-row { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:7px; }
.slot-title-row strong { color:#1f2937; font-size:16px; line-height:1.35; }
.slot-main > p { margin:0 0 12px; color:#4b5563; font-size:13px; line-height:1.65; }
.slot-detail-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:7px 12px; color:#6b7280; font-size:12px; line-height:1.55; }
.slot-detail-grid span { min-width:0; }
.slot-detail-grid i { margin-right:5px; color:#0066cc; }
.slot-detail-grid b { color:#1f2937; }
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
.download-weather { margin:0 0 28px; border-radius:28px; background:rgba(255,255,255,.78); padding:24px 28px; }
.download-weather strong { display:block; margin-bottom:8px; font-size:22px; }
.download-weather p { margin:0; color:#6b7280; font-size:16px; line-height:1.55; }
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
@keyframes travel-spin { to { transform:rotate(360deg); } }
@media (max-width:768px) {
  main { padding-left:14px !important; padding-right:14px !important; }
  .travel-form-panel { padding:20px !important; border-radius:28px !important; }
  .travel-output-panel { min-height:auto; }
  .empty-travel-card { min-height:560px; }
  .empty-travel-content { padding:28px; }
  .empty-travel-content h2 { font-size:30px; }
  .result-hero-card { display:flex !important; flex-direction:column; padding:0 !important; min-height:auto; gap:0; background:rgba(255,255,255,.78); }
  .result-hero-image { position:relative !important; order:1; width:100% !important; height:230px !important; border-radius:0 0 28px 28px; opacity:1; }
  .hero-mask { mask-image:none; }
  .result-hero-copy { order:2; width:100%; max-width:none; padding:22px 22px 6px; }
  .result-hero-copy h2 { font-size:28px; line-height:1.15; word-break:keep-all; overflow-wrap:break-word; }
  .result-download-btn { display:none; }
  .mobile-download-btn { display:flex; position:sticky; top:70px; z-index:25; margin:0 0 12px; }
  .result-actions { flex-direction:column; align-items:stretch; }
  .active-plan-heading { flex-direction:column; }
  .active-plan-badges { justify-content:flex-start; }
  .weather-card-head { flex-direction:column; gap:8px; }
  .hotel-map-card { grid-template-columns:1fr; }
  .hotel-map-list a { grid-template-columns:1fr 28px; }
  .hotel-map-list span { grid-column:1 / -1; }
  .save-history-btn { width:100%; }
  .history-list button { align-items:flex-start; flex-direction:column; gap:4px; }
  .slot-card { grid-template-columns:1fr; gap:10px; padding:15px; }
  .slot-time { flex-direction:row; align-items:center; justify-content:space-between; }
  .slot-title-row { align-items:flex-start; }
  .slot-detail-grid { grid-template-columns:1fr; }
  .date-range-trigger { grid-template-columns:1fr 20px 1fr; padding:10px; }
  .date-grid button { min-height:40px; border-radius:14px; }
}
</style>
