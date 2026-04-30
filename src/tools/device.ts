const UA: string = navigator.userAgent.toLowerCase()

export const isWeChat: boolean = /micromessenger/i.test(UA)

export const isMobile: boolean = !!/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(UA)

export const isWeChatWork: boolean = !!/wxwork/i.test(UA)

export const isEpa: boolean = isWeChatWork

export const isIos: boolean = !!/iPhone|iPad|iPod/i.test(UA)
