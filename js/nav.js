// navigation
export function initNav() {
    const pages = Array.from(document.querySelectorAll('.nav-btn'))
        .map(btn => btn.getAttribute('data-page'))
        .filter(page => page);
    u('.nav-btn').on('click', e => {
        const page = e.target.closest('.nav-btn').getAttribute('data-page');
        pages.forEach(p => {
            u(`#page-${p}`).removeClass('active');
            u(`.nav-btn[data-page="${p}"]`).removeClass('active');
        });
        u(`#page-${page}`).addClass('active');
        u(`.nav-btn[data-page="${page}"]`).addClass('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}