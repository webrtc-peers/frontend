type ToastMessage = string | { message?: string; msg?: string }

export function toast(message: ToastMessage, time: number = 3000): void {
	const div = document.createElement('div')
	div.style.cssText = `padding: 3vw;
        border-radius: 1vw;
        background: rgba(0, 0, 0, 0.8);
        color: #fff;
        position: fixed;
        left: 50%;
        transform: translate(-50%, -50%);
        top: 50%;`
	div.innerHTML = typeof message === 'string' ? message : message.message || message.msg || String(message)
	document.body.appendChild(div)
	setTimeout(() => {
		div.remove()
	}, time)
}
