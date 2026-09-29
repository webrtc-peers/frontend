type ToastMessage = string | { message?: string; msg?: string }

export function toast(message: ToastMessage, time: number = 3000): void {
	const div = document.createElement('div')
	div.style.cssText = `padding: 10px 18px;
        border-radius: 999px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        background: #2a2f2b;
        box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.6);
        color: #e6e8e3;
        font-size: 14px;
        position: fixed;
        z-index: 2000;
        left: 50%;
        transform: translateX(-50%);
        top: calc(env(safe-area-inset-top, 0px) + 24px);`
	div.innerHTML = typeof message === 'string' ? message : message.message || message.msg || String(message)
	document.body.appendChild(div)
	setTimeout(() => {
		div.remove()
	}, time)
}
