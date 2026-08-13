// 1. Efecto Fade-In al hacer scroll
const fadeElements = document.querySelectorAll('.fade-in');

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            // Cuando el elemento entra en la pantalla, le añadimos la clase 'visible'
            entry.target.classList.add('visible');
            
            // 2. Si el elemento que acaba de aparecer tiene contadores, los animamos
            const counters = entry.target.querySelectorAll('.counter');
            counters.forEach(counter => animateCounter(counter));
            
            // Dejamos de observarlo para que la animación solo se haga una vez
            observer.unobserve(entry.target);
        }
    });
}, {
    threshold: 0.1 // Salta cuando al menos el 10% del elemento es visible
});

fadeElements.forEach(el => observer.observe(el));


// 3. Lógica para animar los números
function animateCounter(counter) {
    const target = +counter.getAttribute('data-target'); // El número final (ej: 2300)
    const duration = 2000; // Duración de la animación en milisegundos (2 segundos)
    const increment = target / (duration / 16); // 16ms es aprox 1 frame a 60fps

    let currentCount = 0;

    const updateCounter = () => {
        currentCount += increment;
        
        if (currentCount < target) {
            counter.innerText = Math.ceil(currentCount);
            requestAnimationFrame(updateCounter); // Llama al siguiente frame
        } else {
            counter.innerText = target; // Aseguramos que termine en el número exacto
        }
    };

    updateCounter();
}