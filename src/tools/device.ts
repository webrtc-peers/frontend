const UA: string = navigator.userAgent.toLowerCase()

export const isMobile: boolean = !!/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(UA)
