(async () => {
	// Just a quick hack to get this working
	// The repo is only designed to show a security flaw,
	// Not to make a real pirating tool
	const link = document.querySelector('a');
	const select = document.querySelector('select');
	select.addEventListener('change', () => {
		link.href = `/fapro?v=${select.value}`;
	});
})();