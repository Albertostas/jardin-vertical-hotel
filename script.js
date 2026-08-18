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

// NUEVA FUNCIÓN DINÁMICA: Formatea el número y convierte a Kg si es gigante
function formatNumberWithSpan(value, decimals) {
    let displayValue = value;
    let unit = 'g'; // Unidad por defecto
    
    // Si el valor llega a 1.000.000 de gramos, pasamos a Kilos para no romper el diseño
    if (value >= 10000000) { 
        displayValue = value / 1000;
        unit = 'kg';
    }
    
    // Separa el número en enteros y decimales
    const parts = displayValue.toFixed(decimals).split('.');
    const integerPart = parseInt(parts[0]).toLocaleString('es-ES'); 
    const decimalPart = parts[1];
    
    // Devuelve el HTML inyectando también la unidad (g o kg) de forma dinámica
    return `${integerPart}<span class="decimals">,${decimalPart}</span><span class="unit">${unit}</span>`;
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

// 4. Interactividad: FLIP con Coordenadas Puras
const plantCards = document.querySelectorAll('.plant-card');
let isAnimating = false; 

plantCards.forEach((card, index) => {
    card.style.order = index;
    card.dataset.index = index;
});

plantCards.forEach(card => {
    card.addEventListener('click', async () => {
        if (isAnimating) return; 
        
        const isExpanded = card.classList.contains('expanded');
        const currentlyExpanded = document.querySelector('.plant-card.expanded');

        // ESCENARIO A: Cierra la tarjeta
        if (isExpanded) {
            await runSmoothFlip(() => {
                card.classList.remove('expanded');
                // FIX: Restauramos el orden de TODAS las tarjetas para evitar que la hermana se quede cruzada
                plantCards.forEach(c => c.style.order = c.dataset.index); 
            }, card); 
            return;
        } 
        
        // ESCENARIO B: Cambio entre tarjetas
        if (currentlyExpanded) {
            await runSmoothFlip(() => {
                currentlyExpanded.classList.remove('expanded');
                // FIX: Restauramos el orden de TODAS
                plantCards.forEach(c => c.style.order = c.dataset.index);
            }, currentlyExpanded);
            
            await new Promise(resolve => setTimeout(resolve, 150));
        }
        
        // ESCENARIO C: Abre nueva tarjeta
        await runSmoothFlip(() => {
            card.classList.add('expanded');
            const index = parseInt(card.dataset.index);
            
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

// NUEVA FUNCIÓN MÁGICA: offsetTop y offsetWidth son píxeles puros, enteros, y no se ven afectados por el scroll.
function getAbsoluteRect(el) {
    return {
        top: el.offsetTop,
        left: el.offsetLeft,
        width: el.offsetWidth,
        height: el.offsetHeight
    };
}

// El motor FLIP definitivo con Escudo Universal
async function runSmoothFlip(domUpdateFunction, targetCard) {
    isAnimating = true;
    
    // 1. FOTO INICIAL
    const firstRects = new Map();
    plantCards.forEach(c => {
        firstRects.set(c, {
            card: getAbsoluteRect(c),
            img: getAbsoluteRect(c.querySelector('.plant-img'))
        });
    });

    // 2. CAMBIO DE DOM 
    domUpdateFunction();
    document.body.offsetHeight; // Obligamos al navegador a aplicar el grid

    // 3. FOTO FINAL
    const lastRects = new Map();
    plantCards.forEach(c => {
        lastRects.set(c, {
            card: getAbsoluteRect(c)
        });
    });

    // 4. CONGELACIÓN DE IMÁGENES (Como tú bien viste que era necesario)
    plantCards.forEach(c => {
        const img = c.querySelector('.plant-img');
        const firstImg = firstRects.get(c).img;
        img.style.width = `${firstImg.width}px`;
        img.style.height = `${firstImg.height}px`;
        img.style.flexShrink = '0'; 
    });

    // 5. ANIMACIÓN FLIP (ESCUDO UNIVERSAL)
    const animations = [];
    plantCards.forEach(c => {
        const first = firstRects.get(c).card;
        const last = lastRects.get(c).card;
        
        const deltaX = first.left - last.left;
        const deltaY = first.top - last.top;
        
        c.style.zIndex = (c === targetCard) ? '10' : '5';
        
        // LA CLAVE: Ya no hay condicional. 
        // Aplicamos la animación a TODAS las tarjetas. 
        // Las que están arriba quietas tendrán deltaX=0, deltaY=0 y su mismo tamaño.
        // Pero al animarse, WAAPI bloquea sus dimensiones, haciéndolas inmunes al Grid.
        const keyframes = [
            { transform: `translate(${deltaX}px, ${deltaY}px)`, width: `${first.width}px`, height: `${first.height}px` },
            { transform: `translate(0px, 0px)`, width: `${last.width}px`, height: `${last.height}px` }
        ];
        
        const anim = c.animate(keyframes, {
            duration: 650, 
            easing: 'cubic-bezier(0.25, 1, 0.5, 1)' 
        });
        
        anim.onfinish = () => { c.style.zIndex = ''; };
        animations.push(anim.finished);
    });
    
    // 6. ESPERA Y LIMPIEZA
    if (animations.length > 0) {
        await Promise.all(animations);
    }
    
    // Quitamos los candados a las imágenes
    plantCards.forEach(c => {
        const img = c.querySelector('.plant-img');
        img.style.width = '';
        img.style.height = '';
        img.style.flexShrink = '';
    });
    
    isAnimating = false;
}

// 5. STICKY HEADER (Motor Suavizado, Sin Fantasmas y Tracker a Media Pantalla)
const stickyHeader = document.getElementById('sticky-header');
const stickyLeft = document.querySelector('.sticky-left');
const stickyStats = document.querySelectorAll('.sticky-stat'); 

const stickyLogoMold = document.querySelector('.sticky-logo'); 
const mainLogoImg = document.querySelector('.logo-img'); 
const floatingLogo = document.getElementById('floating-logo'); 

const mainStatCards = document.querySelectorAll('.stat-card'); 

const plantsSection = document.querySelector('.plants-section'); 
const subtitleTrack = document.querySelector('.subtitle-track'); 

// Arrancamos los mini-contadores
document.querySelectorAll('.sticky-right .counter').forEach(counter => {
    const type = counter.getAttribute('data-type');
    startLiveUpdates(counter, type, 3);
});

function calculateScrollProgress(element, startFade, endFade) {
    if (!element) return 0;
    const rect = element.getBoundingClientRect();
    let progress = (startFade - rect.top) / (startFade - endFade);
    return Math.max(0, Math.min(1, progress));
}

function onScrollRender() {
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    
    // 1. EL LOGO VOLADOR 
    const linearProgress = Math.max(0, Math.min(1, scrollY / 350));
    const morphProgress = 1 - Math.pow(1 - linearProgress, 5);

    // 2. TRACKER DE SECCIONES (Ahora salta en el ecuador de la pantalla)
    // 2. TRACKER DE SECCIONES (Ajustado milimétricamente a tu captura)
    if (plantsSection && subtitleTrack) {
        const rect = plantsSection.getBoundingClientRect();
        
        // En lugar de usar la mitad de la pantalla, fijamos el "láser" a 280px del techo.
        // Cuando la sección suba y cruce esa línea de 280px, el texto rotará.
        const triggerPoint = 250; 
        
        if (rect.top < triggerPoint) {
            subtitleTrack.classList.add('show-ecosistema'); 
        } else {
            subtitleTrack.classList.remove('show-ecosistema'); 
        }
    }

    const co2Progress = mainStatCards[0] ? calculateScrollProgress(mainStatCards[0], 150, 40) : 0;
    const o2Progress = mainStatCards[1] ? calculateScrollProgress(mainStatCards[1], 150, 40) : 0;

    const maxProgress = Math.max(morphProgress, co2Progress, o2Progress);
    
    stickyHeader.style.background = `rgba(255, 255, 255, ${maxProgress * 0.85})`;
    stickyHeader.style.backdropFilter = `blur(${maxProgress * 12}px)`;
    stickyHeader.style.webkitBackdropFilter = `blur(${maxProgress * 12}px)`;
    stickyHeader.style.borderBottom = `1px solid rgba(255, 255, 255, ${maxProgress * 0.5})`;
    stickyHeader.style.boxShadow = `0 4px 15px rgba(0, 0, 0, ${maxProgress * 0.05})`;

    // 3. ANIMACIÓN DEL LOGO (Sin duplicados fantasma)
    if (mainLogoImg && stickyLogoMold && floatingLogo) {
        // SOLUCIÓN: Ocultamos el logo original de la web SIEMPRE. 
        // El clon volador asume el 100% del protagonismo desde el píxel 0.
        mainLogoImg.style.opacity = 0; 
        
        stickyLeft.style.opacity = morphProgress; 
        
        const sourceRect = mainLogoImg.getBoundingClientRect();
        const targetRect = stickyLogoMold.getBoundingClientRect();
        
        if (targetRect.width > 0) {
            const currentWidth = sourceRect.width + (targetRect.width - sourceRect.width) * morphProgress;
            const currentTop = sourceRect.top + (targetRect.top - sourceRect.top) * morphProgress;
            const currentLeft = sourceRect.left + (targetRect.left - sourceRect.left) * morphProgress;
            
            floatingLogo.style.width = `${currentWidth}px`;
            floatingLogo.style.top = `${currentTop}px`;
            floatingLogo.style.left = `${currentLeft}px`;
            
            // El clon siempre es visible
            floatingLogo.style.opacity = 1;
        }
    }

    // 4. ANIMACIONES INDIVIDUALES PÍLDORAS
    if (mainStatCards[0] && stickyStats[0]) {
        mainStatCards[0].style.opacity = 1 - co2Progress;
        stickyStats[0].style.opacity = co2Progress;
        stickyStats[0].style.transform = `translateY(${(1 - co2Progress) * 15}px)`;
    }

    if (mainStatCards[1] && stickyStats[1]) {
        mainStatCards[1].style.opacity = 1 - o2Progress;
        stickyStats[1].style.opacity = o2Progress;
        stickyStats[1].style.transform = `translateY(${(1 - o2Progress) * 15}px)`;
    }
}

window.addEventListener('scroll', () => requestAnimationFrame(onScrollRender), { passive: true });
setTimeout(onScrollRender, 10);