function checkTheme() {
    if (window.NexusTheme) {
        window.NexusTheme.set(window.NexusTheme.get());
    }
}

function toggleTheme() {
    const isDark = document.documentElement.classList.contains('dark');
    if (window.NexusTheme) {
        window.NexusTheme.set(isDark ? 'light' : 'dark');
    } else {
        document.documentElement.classList.toggle('dark');
    }
}

checkTheme();
