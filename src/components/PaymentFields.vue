<script setup lang="ts">
import type { Payment } from '../types';
import { formatDate, formatMoney } from '../types';
defineProps<{ payment: Payment }>();
</script>
<template>
  <dl class="compact-fields">
    <div><dt>商户单号</dt><dd translate="no">{{ payment.outTradeNo || '—' }}</dd></div>
    <div><dt>交易单号</dt><dd translate="no">{{ payment.transactionId || '尚无交易单号' }}</dd></div>
    <div><dt>支付渠道</dt><dd>{{ payment.channelCode || '—' }}</dd></div>
    <div><dt>支付流水状态</dt><dd>{{ payment.statusName }}</dd></div>
    <div><dt>支付金额</dt><dd>{{ formatMoney(payment.amount) }}</dd></div>
    <div><dt>发起支付时间</dt><dd>{{ formatDate(payment.createdAt) }}</dd></div>
    <div v-if="payment.paidAt"><dt>支付成功时间</dt><dd>{{ formatDate(payment.paidAt) }}</dd></div>
  <div v-if="payment.refundedAt"><dt>退款时间</dt><dd>{{ formatDate(payment.refundedAt) }}</dd></div>
  </dl>
</template>
