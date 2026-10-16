<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import type { Customer, Detail, Page, SearchType } from './types';
import { formatDate } from './types';
import OrderCore from './components/OrderCore.vue';
const prefix = '/admin/consult/staff';
const apiBase = import.meta.env.VITE_API_BASE || `${import.meta.env.BASE_URL}api`;
const token = ref(sessionStorage.getItem('consultStaffToken') || '');
const employeeName = ref(sessionStorage.getItem('consultStaffName') || '客服');
const account = ref(''); const password = ref(''); const busy = ref(false); const error = ref('');
const screen = ref<'login' | 'customers' | 'detail'>('login');
const customers = ref<Customer[]>([]); const detail = ref<Detail>();
const keyword = ref(''); const searchType = ref<SearchType>('ORDER_ID');
const applied = ref({ keyword: '', searchType: 'ORDER_ID' as SearchType });
const page = ref(1); const total = ref(0);
const selectedOrderId = ref<string>();
const downloadingPdf = ref(false);
const reportExpanded = ref(true);
let returnScroll = 0;
const searchLabels: Record<SearchType, string> = { ORDER_ID: '订单号', OUT_TRADE_NO: '商户单号', TRANSACTION_ID: '交易单号', SUBJECT_NAME: '测评姓名' };
// 通知凭据仅存内存，不写入路由、存储或日志。
const fragment = new URLSearchParams(location.hash.slice(1));
const linkOrderId = fragment.get('orderId');
const linkCredential = fragment.get('taskId') && fragment.get('ticket') ? `${fragment.get('taskId')}.${fragment.get('ticket')}` : '';
if (location.hash) history.replaceState(null, '', location.pathname + location.search);
const linkMode = !!linkCredential;
async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const authorization = linkMode ? `ConsultLink ${linkCredential}` : `Bearer ${token.value}`;
  const response = await fetch(apiBase + path, { ...options, cache: 'no-store', headers: { 'Content-Type': 'application/json', Authorization: authorization, ...options.headers } });
  const result = await response.json();
  if (!response.ok || result.code !== 200) {
    if ((response.status === 401 || response.status === 403) && !linkMode) {
      token.value = ''; sessionStorage.removeItem('consultStaffToken'); customers.value = []; detail.value = undefined; screen.value = 'login';
    }
    throw new Error(result.message || '请求失败，请重试');
  }
  return result.data;
}
async function action(run: () => Promise<void>) {
  if (busy.value) return;
  busy.value = true; error.value = '';
  try { await run(); } catch (e) { error.value = e instanceof Error ? e.message : '操作失败，请重试'; }
  finally { busy.value = false; }
}
function searchParams() { return new URLSearchParams(applied.value).toString(); }
async function login() { await action(async () => {
  const result = await api<{ token: string; memberName: string }>(prefix + '/login', { method: 'POST', body: JSON.stringify({ account: account.value, password: password.value }) });
  token.value = result.token; employeeName.value = result.memberName; password.value = '';
  sessionStorage.setItem('consultStaffToken', token.value); sessionStorage.setItem('consultStaffName', employeeName.value);
  page.value = 1; screen.value = 'customers'; await loadCustomers();
});
  if (token.value && !error.value) await openRequestedOrder();
}
async function logout() { await action(async () => {
  await api('/auth/logout', { method: 'POST' }); token.value = ''; sessionStorage.removeItem('consultStaffToken'); sessionStorage.removeItem('consultStaffName'); detail.value = undefined; customers.value = []; screen.value = 'login';
}); }
async function loadCustomers() {
  customers.value = []; total.value = 0;
  const result = await api<Page<Customer>>(`${prefix}/customers?page=${page.value}&size=20&${searchParams()}`);
  customers.value = result.records; total.value = Number(result.total);
}
async function search() {
  applied.value = { keyword: keyword.value.trim(), searchType: searchType.value }; page.value = 1;
  await action(loadCustomers);
}
async function showDetail(orderId: string) {
  if (busy.value) return;
  selectedOrderId.value = orderId;
  returnScroll = window.scrollY;
  detail.value = undefined; reportExpanded.value = true; screen.value = 'detail';
  await action(async () => { detail.value = await api<Detail>(`${prefix}/orders/${encodeURIComponent(orderId)}`); });
  await nextTick(); window.scrollTo(0, 0); document.getElementById('page-title')?.focus();
}
async function downloadReportPdf() {
  if (!detail.value?.paidReport || downloadingPdf.value) return;
  downloadingPdf.value = true; error.value = '';
  try {
    const authorization = linkMode ? `ConsultLink ${linkCredential}` : `Bearer ${token.value}`;
    const response = await fetch(
      `${apiBase}${prefix}/orders/${encodeURIComponent(detail.value.order.orderId)}/report/pdf`,
      { cache: 'no-store', headers: { Authorization: authorization } },
    );
    if (!response.ok) {
      const result = await response.json().catch(() => undefined);
      throw new Error(result?.message || 'PDF 下载失败，请稍后重试');
    }
    const blobUrl = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `报告_${detail.value.order.orderId}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'PDF 下载失败，请稍后重试';
  } finally {
    downloadingPdf.value = false;
  }
}
async function openRequestedOrder() {
  const params = new URLSearchParams(location.search);
  if (token.value && params.get('orderId')) await showDetail(params.get('orderId')!);
}
async function back() {
  detail.value = undefined; error.value = ''; screen.value = 'customers';
  await nextTick(); document.getElementById(`order-${selectedOrderId.value}`)?.focus({ preventScroll: true }); window.scrollTo(0, returnScroll);
}
async function turnPage(offset: number) { page.value += offset; await action(loadCustomers); }
const reportHtml = computed(() => DOMPurify.sanitize(marked.parse(detail.value?.paidReport || '', { async: false }), { FORBID_TAGS: ['img', 'iframe', 'form'], FORBID_ATTR: ['style'] }));
const userQuestion = computed(() => detail.value?.userQuestion?.trim() || '');
const validAnswers = computed(() => (detail.value?.answers || []).filter((row) => row.question?.trim() && row.answer?.trim()));
const validSubjects = computed(() => (detail.value?.subjects || []).filter((row) =>
  row.userName?.trim()
  || row.userGender === 1
  || row.userGender === 2
  || row.userBirthday
  || row.userBirthTime?.trim()
  || row.userBirthPlace?.trim(),
));
function onLinkNavigation() {
  const params = new URLSearchParams(location.hash.slice(1));
  if (params.has('ticket') && params.has('taskId') && params.has('orderId')) location.reload();
}
onBeforeUnmount(() => window.removeEventListener('hashchange', onLinkNavigation));
onMounted(async () => {
  window.addEventListener('hashchange', onLinkNavigation);
  if (linkMode && linkOrderId) await showDetail(linkOrderId);
  else if (token.value) {
    screen.value = 'customers'; await action(loadCustomers);
    await openRequestedOrder();
  }
});
</script>
<template>
  <a class="skip-link" href="#main-content">跳至主要内容</a>
  <header><div class="brand"><span class="brand-mark" aria-hidden="true">悦</span><div>客户服务台<small>咨询服务工作台</small></div></div><div v-if="token && !linkMode" class="account"><span>{{ employeeName }}</span><button class="quiet" :disabled="busy" @click="logout">退出</button></div></header>
  <main id="main-content" tabindex="-1" :aria-busy="busy">
    <div v-if="error" class="error" role="alert"><strong>操作未完成</strong><span>{{ error }}</span></div>
    <section v-if="screen === 'login' && !linkMode" class="login panel">
      <span class="login-symbol" aria-hidden="true">悦</span><h1>登录客户服务台</h1><p class="muted">登录后查看您负责的客户与咨询资料</p>
      <form @submit.prevent="login"><label>账号<input v-model="account" name="account" :spellcheck="false" autocapitalize="none" autocomplete="username" placeholder="请输入后台账号…" required /></label><label>密码<input v-model="password" name="password" type="password" autocomplete="current-password" placeholder="请输入密码…" required /></label><button class="primary" :disabled="busy">{{ busy ? '正在登录…' : '登录服务台' }}</button></form>
    </section>
    <template v-else>
      <div v-if="screen === 'detail'" class="page-heading"><h1 id="page-title" tabindex="-1">订单详情</h1><button v-if="!linkMode" :disabled="busy" @click="back">返回客户列表</button></div>
      <section v-if="screen === 'customers'" class="data-panel">
        <div class="list-toolbar"><h1 class="list-label list-title">客户列表<span class="count">{{ total }}</span></h1>
          <form class="search staff-search" role="search" @submit.prevent="search">
            <select v-model="searchType" name="searchType" aria-label="查询类型" :disabled="busy"><option v-for="(label, value) in searchLabels" :key="value" :value="value">{{ label }}</option></select>
            <input v-model="keyword" name="keyword" autocomplete="off" type="search" :spellcheck="false" :placeholder="searchType === 'SUBJECT_NAME' ? '输入测评姓名，支持部分姓名…' : `输入${searchLabels[searchType]}…`" :aria-label="searchLabels[searchType]" maxlength="100" :disabled="busy" /><button class="primary" :disabled="busy">搜索</button>
          </form>
        </div>
        <p v-if="busy" class="loading" role="status">正在加载，请稍候…</p>
        <div class="customer-groups">
          <section v-for="row in customers" :key="row.userId" class="customer-group">
            <div class="customer-overview">
              <div class="identity"><span class="avatar" aria-hidden="true">{{ (row.nickname || '客').slice(0, 1) }}</span><div class="identity-text"><h2>{{ row.nickname || '未命名客户' }}</h2><small translate="no">用户编号 {{ row.userId }}</small><small v-if="row.phone">{{ row.phone }}</small><small>最近发起咨询：{{ row.lastConsultAt ? formatDate(row.lastConsultAt) : '尚未发起咨询' }}</small></div></div>
            </div>
            <div class="customer-orders">
              <a v-for="order in row.orders" :id="`order-${order.orderId}`" :key="order.orderId" class="order-summary" :class="{ 'is-match': order.matched }" :href="`?orderId=${encodeURIComponent(order.orderId)}`" :aria-label="`查看订单 ${order.orderId} 详情`" @click.exact.prevent="showDetail(order.orderId)">
                <div class="order-title"><h3>{{ order.productName }}</h3><span v-if="order.matched" class="match-badge">查询命中</span></div>
                <dl class="summary-fields">
                  <div><dt>订单号</dt><dd translate="no">{{ order.orderId }}</dd></div>
                  <div><dt>下单时间</dt><dd>{{ formatDate(order.createdAt) }}</dd></div>
                </dl>
              </a>
              <p v-if="!row.orders?.length" class="muted">暂无订单</p>
            </div>
          </section>
        </div>
        <div v-if="!busy && !error && !customers.length" class="empty"><strong>{{ applied.keyword ? '没有找到匹配的客户' : '暂无客户' }}</strong><p>{{ applied.keyword ? '请核对查询类型和姓名或单号，或清空搜索后重试。' : '客户分配给您后，会显示在这里。' }}</p></div>
        <button v-if="error && !busy" class="retry-button" @click="action(loadCustomers)">重新加载客户</button>
        <nav class="pagination" aria-label="客户分页"><span>共 {{ total }} 位客户</span><div><button :disabled="busy || page <= 1" @click="turnPage(-1)">上一页</button><span aria-live="polite">{{ page }} / {{ Math.max(1, Math.ceil(total / 20)) }}</span><button :disabled="busy || page * 20 >= total" @click="turnPage(1)">下一页</button></div></nav>
      </section>
      <p v-if="busy && screen === 'detail'" class="loading" role="status">正在加载订单资料…</p>
      <article v-if="detail" class="detail">
        <section class="panel"><div class="section-heading"><h2>{{ detail.customer.nickname || '客户资料' }}</h2></div><dl class="detail-meta-fields"><div><dt>用户编号</dt><dd translate="no">{{ detail.customer.userId }}</dd></div><div><dt>注册时间</dt><dd>{{ formatDate(detail.customer.registeredAt) }}</dd></div><div><dt>最近发起咨询</dt><dd>{{ detail.customer.lastConsultAt ? formatDate(detail.customer.lastConsultAt) : '尚未发起咨询' }}</dd></div><div v-if="detail.customer.phone"><dt>手机号</dt><dd>{{ detail.customer.phone }}</dd></div></dl></section>
        <section class="panel"><h2>订单信息</h2><OrderCore :order="detail.order" /></section>
        <details v-if="validSubjects.length" class="panel disclosure" open><summary><span>已提交资料</span><small class="closed-hint">点击展开</small><small class="open-hint">点击收起</small></summary><div v-for="(subject, index) in validSubjects" :key="index" class="answer"><h3>{{ subject.label || `资料 ${index + 1}` }}</h3><p v-if="subject.userName?.trim()">姓名：{{ subject.userName }}</p><p v-if="subject.userGender === 1 || subject.userGender === 2">性别：{{ subject.userGender === 1 ? '男' : '女' }}</p><p v-if="subject.userBirthday">出生日期：{{ subject.userBirthday }}</p><p v-if="subject.userBirthTime?.trim()">出生时间：{{ subject.userBirthTime }}</p><p v-if="subject.userBirthPlace?.trim()">出生地：{{ subject.userBirthPlace }}</p></div></details>
        <details v-if="validAnswers.length || userQuestion" class="panel disclosure" open><summary><span>答题内容</span><small class="closed-hint">点击展开</small><small class="open-hint">点击收起</small></summary><p v-if="userQuestion">{{ userQuestion }}</p><div v-for="(answer, index) in validAnswers" :key="index" class="answer"><h3>{{ index + 1 }}. {{ answer.question }}</h3><p>{{ answer.answer }}</p></div></details>
        <section class="panel report-panel"><div class="report-heading"><h2>付费报告</h2><div v-if="detail.paidReport" class="report-actions"><button class="quiet report-toggle" aria-controls="paid-report-content" :aria-expanded="reportExpanded" @click="reportExpanded = !reportExpanded">{{ reportExpanded ? '收起报告内容' : '查看报告内容' }}</button><button :disabled="downloadingPdf" @click="downloadReportPdf">{{ downloadingPdf ? '正在生成 PDF…' : '下载 PDF' }}</button></div></div><div v-if="detail.paidReport && reportExpanded" id="paid-report-content" class="report report-content" v-html="reportHtml"></div><p v-else-if="!detail.paidReport" class="muted report-empty">报告尚未生成或暂无可展示内容。</p></section>
        <p v-if="linkMode" class="privacy-note">此页面仅展示本次咨询订单资料。请妥善保管资料链接。</p>
      </article>
    </template>
  </main><footer>悦测 · 客户服务台</footer>
</template>
