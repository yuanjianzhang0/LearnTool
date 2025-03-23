document.addEventListener('DOMContentLoaded', () => {
    particlesJS('particles-js', {
        "particles": {
            "number": {"value": 80, "density": {"enable": true, "value_area": 800}},
            "color": {"value": "#ffffff"},
            "shape": {"type": "circle", "stroke": {"width": 0, "color": "#000000"}},
            "opacity": {"value": 0.5, "random": true, "anim": {"enable": false, "speed": 1, "opacity_min": 0.1, "sync": false}},
            "size": {"value": 3, "random": true, "anim": {"enable": false, "speed": 40, "size_min": 0.1, "sync": false}},
            "line_linked": {"enable": true, "distance": 150, "color": "#ffffff", "opacity": 0.4, "width": 1},
            "move": {"enable": true, "speed": 2, "direction": "none", "random": false, "straight": false, "out_mode": "out", "bounce": false}
        },
        "interactivity": {
            "detect_on": "canvas",
            "events": {"onhover": {"enable": true, "mode": "grab"}, "onclick": {"enable": true, "mode": "push"}, "resize": true},
            "modes": {"grab": {"distance": 140, "line_linked": {"opacity": 1}}, "push": {"particles_nb": 4}}
        },
        "retina_detect": true
    });

    const overlay = document.querySelector('.overlay');
    const content = document.querySelector('.content');
    const h1 = content.querySelector('h1');
    const p = content.querySelector('p');
    const tryNowBtn = content.querySelector('.try-now-btn');
    const highSchoolBtn = content.querySelector('.high-school-btn');
    const scrollDown = document.querySelector('.scroll-down');

    window.addEventListener('scroll', () => {
        const scrollPosition = window.scrollY;
        const windowHeight = window.innerHeight;

        if (scrollPosition > windowHeight / 2) {
            overlay.classList.add('active');
            content.classList.add('active');
            scrollDown.style.opacity = '0';

            setTimeout(() => h1.style.animation = 'slideInLeft 1s forwards', 0);
            setTimeout(() => p.style.animation = 'slideInLeft 1s forwards', 300);
            setTimeout(() => tryNowBtn.style.animation = 'bounceIn 1s forwards', 600);
            setTimeout(() => highSchoolBtn.style.animation = 'bounceIn 1s forwards', 900);
        } else {
            overlay.classList.remove('active');
            content.classList.remove('active');
            scrollDown.style.opacity = '1';

            h1.style.animation = 'none';
            p.style.animation = 'none';
            tryNowBtn.style.animation = 'none';
            highSchoolBtn.style.animation = 'none';
            h1.style.opacity = '0';
            p.style.opacity = '0';
            tryNowBtn.style.opacity = '0';
            highSchoolBtn.style.opacity = '0';
        }
    });
});