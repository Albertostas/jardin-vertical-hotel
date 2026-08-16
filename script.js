// 1. Efecto Fade-In al hacer scroll
const fadeElements = document.querySelectorAll('.fade-in');

// Fechas de instalación
const installInterior = new Date('2024-05-23T08:00:00').getTime(); // Mayo de 2024
const installExterior = new Date('2026-05-16T08:00:00').getTime(); // Mayo de 2026

// Tasas en gramos por milisegundo separadas por muro
const ratesInterior = {
    co2: 0.000005452,
    o2: 0.000004030,
    toxins: 0.000000308
};

const ratesExterior = {
    co2: 0.000008178,
    o2: 0.000006044,
    toxins: 0.000000462
};

// Función maestra que calcula lo generado por ambos muros sumados
function calculateRealValue(type) {
    const now = Date.now();
    const msInterior = Math.max(0, now - installInterior);
    const msExterior = Math.max(0, now - installExterior);
    
    const valInterior = msInterior * ratesInterior[type];
    const valExterior = msExterior * ratesExterior[type];
    
    return valInterior + valExterior;
}

// NUEVA FUNCIÓN: Formatea el número (1.234,567) y hace pequeños los decimales
function formatNumberWithSpan(value, decimals) {
    // Separa el número en enteros y decimales
    const parts = value.toFixed(decimals).split('.');
    
    // Pone el punto de los miles (formato español)
    const integerPart = parseInt(parts[0]).toLocaleString('es-ES'); 
    const decimalPart = parts[1];
    
    // Devuelve el HTML con la coma y la clase para el tamaño
    return `${integerPart}<span class="decimals">,${decimalPart}</span>`;
}

// Observador para activar la animación al hacer scroll
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            
            const counters = entry.target.querySelectorAll('.counter');
            counters.forEach(counter => {
                const type = counter.getAttribute('data-type');
                animateLiveCounter(counter, type, 3); 
            });
            
            observer.unobserve(entry.target);
        }
    });
}, { threshold: 0.1 });

fadeElements.forEach(el => observer.observe(el));

// 2. Lógica de animación inicial (arranque progresivo)
function animateLiveCounter(element, type, decimals) {
    const animationDuration = 2000;
    let startTime = null;

    function step(timestamp) {
        if (!startTime) startTime = timestamp;
        const progress = timestamp - startTime;
        const progressRatio = Math.min(progress / animationDuration, 1);
        
        const easeOutQuart = 1 - Math.pow(1 - progressRatio, 4);
        const currentRealValue = calculateRealValue(type);
        
        if (progressRatio < 1) {
            const currentValue = currentRealValue * easeOutQuart;
            // Usamos innerHTML en lugar de innerText para que lea la etiqueta <span>
            element.innerHTML = formatNumberWithSpan(currentValue, decimals);
            requestAnimationFrame(step);
        } else {
            startLiveUpdates(element, type, decimals);
        }
    }
    
    requestAnimationFrame(step);
}

// 3. Bucle infinito para sumar décimas en directo sin parar
function startLiveUpdates(element, type, decimals) {
    function update() {
        const liveValue = calculateRealValue(type);
        // Usamos innerHTML aquí también
        element.innerHTML = formatNumberWithSpan(liveValue, decimals);
        requestAnimationFrame(update);
    }
    
    requestAnimationFrame(update);
}

// 4. Interactividad PRO: FLIP Restringido (Sin bugs de recolocación)
const plantCards = document.querySelectorAll('.plant-card');
let isAnimating = false; 

// Guardamos el orden original
plantCards.forEach((card, index) => {
    card.style.order = index;
    card.dataset.index = index;
});

plantCards.forEach(card => {
    card.addEventListener('click', async () => {
        if (isAnimating) return; 
        
        const isExpanded = card.classList.contains('expanded');
        const currentlyExpanded = document.querySelector('.plant-card.expanded');

        // ESCENARIO A: Cierra la tarjeta abierta
        if (isExpanded) {
            // Pasamos 'card' para decirle a JS: "Solo a esta le permites cambiar de tamaño"
            await runSmoothFlip(() => {
                card.classList.remove('expanded');
                card.style.order = card.dataset.index; 
            }, card); 
            return;
        } 
        
        // ESCENARIO B: Hay otra abierta. Se cierra, respira, y se abre la nueva.
        if (currentlyExpanded) {
            // Cerramos la vieja
            await runSmoothFlip(() => {
                currentlyExpanded.classList.remove('expanded');
                currentlyExpanded.style.order = currentlyExpanded.dataset.index;
            }, currentlyExpanded);
            
            // EL RESPIRO: 150ms de pausa
            await new Promise(resolve => setTimeout(resolve, 150));
        }
        
        // ESCENARIO C: Abrimos la nueva tarjeta
        await runSmoothFlip(() => {
            card.classList.add('expanded');
            const index = parseInt(card.dataset.index);
            
            // Si está a la derecha, la pasamos a la izquierda y empujamos la otra
            if (index % 2 !== 0) { 
                const sibling = plantCards[index - 1];
                if (sibling) {
                    card.style.order = index - 1;
                    sibling.style.order = index;
                }
            }
        }, card);
    });
});

// El motor FLIP con bloqueo de tamaño para las tarjetas hermanas
async function runSmoothFlip(domUpdateFunction, targetCard) {
    isAnimating = true;
    
    // 1. FOTOGRAFÍA INICIAL
    const rects = new Map();
    plantCards.forEach(c => {
        rects.set(c, {
            card: c.getBoundingClientRect(),
            img: c.querySelector('.plant-img').getBoundingClientRect()
        });
    });

    // 2. CONGELACIÓN: Forzamos la imagen a mantener píxeles exactos
    plantCards.forEach(c => {
        const img = c.querySelector('.plant-img');
        const initialImg = rects.get(c).img;
        img.style.width = `${initialImg.width}px`;
        img.style.height = `${initialImg.height}px`;
        img.style.flexShrink = '0'; 
    });

    // 3. CAMBIO: Aplicamos clases de CSS
    domUpdateFunction();

    // 4. ANIMACIÓN FLIP
    const animations = [];
    plantCards.forEach(c => {
        const first = rects.get(c);
        const last = c.getBoundingClientRect();
        
        const deltaX = first.card.left - last.left;
        const deltaY = first.card.top - last.top;
        
        // LA CLAVE: Solo comprobamos si cambia de tamaño si es la tarjeta protagonista
        const isTarget = (c === targetCard);
        
        // Si se mueve de su sitio O es la protagonista, animamos
        if (deltaX !== 0 || deltaY !== 0 || isTarget) {
            c.style.zIndex = isTarget ? '10' : '5';
            
            const keyframes = [
                { transform: `translate(${deltaX}px, ${deltaY}px)` }
            ];
            
            // SOLO la tarjeta protagonista (la que tocamos) puede expandir/contraer su cuadro blanco
            if (isTarget) {
                keyframes[0].width = `${first.card.width}px`;
                keyframes[0].height = `${first.card.height}px`;
                keyframes.push({ 
                    transform: `translate(0px, 0px)`,
                    width: `${last.width}px`,
                    height: `${last.height}px`
                });
            } else {
                // Las demás hermanas solo se deslizan (manteniendo su cuadrado intacto)
                keyframes.push({ transform: `translate(0px, 0px)` });
            }
            
            const anim = c.animate(keyframes, {
                duration: 650, 
                easing: 'cubic-bezier(0.25, 1, 0.5, 1)' 
            });
            
            anim.onfinish = () => { c.style.zIndex = ''; };
            animations.push(anim.finished);
        }
    });
    
    // 5. ESPERA Y LIMPIEZA
    if (animations.length > 0) {
        await Promise.all(animations);
    }
    
    plantCards.forEach(c => {
        const img = c.querySelector('.plant-img');
        img.style.width = '';
        img.style.height = '';
        img.style.flexShrink = '';
    });
    
    isAnimating = false;
}