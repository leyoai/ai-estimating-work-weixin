<script setup lang="ts">
import type { ConsultOrder } from '../types';
import { formatDate } from '../types';
defineProps<{ order: ConsultOrder }>();
</script>
<template>
  <div class="order-title"><h3>{{ order.productName }}</h3></div>
  <dl class="detail-order-fields">
    <div><dt>订单号</dt><dd translate="no">{{ order.orderId }}</dd></div>
    <div><dt>下单时间</dt><dd>{{ formatDate(order.createdAt) }}</dd></div>
    <div><dt>咨询编号</dt><dd translate="no">{{ order.consultCode || '—' }}</dd></div>
  </dl>
</template>
