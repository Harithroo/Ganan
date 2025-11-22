// Dynamically loads HTML partials into the main app container
export function loadAllPartials(partials, callback) {
    let loaded = 0;
    const total = partials.length;
    partials.forEach(({ id, file }) => {
        fetch(file)
            .then(res => {
                if (!res.ok) throw new Error(`Failed to load ${file}: ${res.status}`);
                return res.text();
            })
            .then(html => {
                const element = document.getElementById(id);
                if (element) {
                    element.innerHTML = html;
                } else {
                    console.error(`Element with id "${id}" not found`);
                }
                loaded++;
                if (loaded === total && typeof callback === 'function') {
                    callback();
                }
            })
            .catch(err => {
                console.error(err);
                loaded++;
                if (loaded === total && typeof callback === 'function') {
                    callback();
                }
            });
    });
}