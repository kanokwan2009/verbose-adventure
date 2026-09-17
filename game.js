// --- AUDIO SYSTEM (Web Audio API Synthesizer) ---
class SoundManager {
    constructor() {
        this.ctx = null;
        this.enabled = true;
    }
    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }
    playTone(freq, type, duration, vol = 0.1) {
        if (!this.enabled || !this.ctx) return;
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
            gain.gain.setValueAtTime(vol, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + duration);
        } catch(e) {}
    }
    step() { this.playTone(150, 'triangle', 0.08, 0.05); }
    chop() { this.playTone(300, 'square', 0.1, 0.1); }
    water() { this.playTone(600, 'sine', 0.2, 0.1); }
    coin() { this.playTone(880, 'sine', 0.15, 0.1); setTimeout(()=>this.playTone(1320, 'sine', 0.2, 0.1), 100); }
    hit() { this.playTone(100, 'sawtooth', 0.15, 0.15); }
}

// --- ITEM & DATABASE ---
const ITEMS = {
    seed_carrot: { name: 'Carrot Seed', type: 'seed', icon: '🌱', crop: 'carrot', price: 10 },
    carrot: { name: 'Carrot', type: 'crop', icon: '🥕', price: 30, energy: 20 },
    seed_potato: { name: 'Potato Seed', type: 'seed', icon: '🥔', crop: 'potato', price: 15 },
    potato: { name: 'Potato', type: 'crop', icon: '🥔', price: 45, energy: 25 },
    wood: { name: 'Wood', type: 'material', icon: '🪵', price: 5 },
    stone: { name: 'Stone', type: 'material', icon: '🪨', price: 8 },
    fish_carp: { name: 'Carp', type: 'fish', icon: '🐟', price: 50, energy: 30 },
    fish_salmon: { name: 'Salmon', type: 'fish', icon: '🐠', price: 100, energy: 50 },
    ore_iron: { name: 'Iron Ore', type: 'material', icon: '⛏️', price: 40 },
    sword: { name: 'Sword', type: 'tool', icon: '🗡️', atk: 10 },
    hoe: { name: 'Hoe', type: 'tool', icon: '🧑‍🌾' },
    watering_can: { name: 'Watering Can', type: 'tool', icon: '🚿' },
    axe: { name: 'Axe', type: 'tool', icon: '🪓' },
    pickaxe: { name: 'Pickaxe', type: 'tool', icon: '⛏️' },
    fishing_rod: { name: 'Fishing Rod', type: 'tool', icon: '🎣' }
};

const CROPS = {
    carrot: { growTime: 30, stages: ['🌱', '🌿', '🥕'] },
    potato: { growTime: 45, stages: ['🌱', '🌿', '🥔'] }
};

// --- MAIN GAME CLASS ---
class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.sound = new SoundManager();
        
        this.screenWidth = window.innerWidth;
        this.screenHeight = window.innerHeight;
        this.canvas.width = this.screenWidth;
        this.canvas.height = this.screenHeight;

        this.state = 'MENU'; // MENU, CREATOR, PLAYING
        this.currentWindow = null;
        this.keys = {};
        
        // Game Time & World State
        this.time = { hour: 6, minute: 0, day: 1, season: 'Spring', year: 1 };
        this.weather = 'Sunny';
        this.gold = 500;
        this.hp = 100;
        this.maxHp = 100;
        this.energy = 100;
        this.maxEnergy = 100;

        // Player Data & Customization
        this.player = {
            x: 400, y: 300, size: 32, speed: 3.5,
            gender: 'm', hair: 1, hairColor: '#8B4513',
            skinColor: '#ffd1b3', shirtColor: '#3498db', pantsColor: '#2c3e50',
            facing: 'down', moving: false, animTimer: 0,
            inventory: Array(20).fill(null),
            activeSlot: 0,
            selectedTool: 'hoe',
            wardrobe: { hair: 1, hat: null, shirt: 'default', pants: 'default', shoes: 'default', accessory: null }
        };

        // World Objects & Maps (Single continuous world / Multi-zone simplified grid)
        this.currentZone = 'farm'; // farm, village, forest, mine, house
        this.farmTiles = {}; // key: "x,y" => { tilled: bool, watered: bool, crop: name, stage: 0, timer: 0 }
        this.worldObjects = []; // trees, rocks, items on ground
        this.npcs = [
            { name: 'Mayor Thomas', x: 200, y: 200, zone: 'village', schedule: 'village', friendship: 0, dialogue: ["Welcome to our valley!", "Make sure to water your crops daily."] },
            { name: 'Robin', x: 500, y: 150, zone: 'village', schedule: 'village', friendship: 0, dialogue: ["Need wood or house upgrades? Let me know!", "The weather is lovely today."] }
        ];
        this.enemies = [];
        this.quests = [
            { id: 1, title: 'First Harvest', desc: 'Grow and harvest a Carrot.', goal: 'harvest_carrot', current: 0, max: 1, reward: 100, completed: false }
        ];

        this.initControls();
        this.initCreatorCanvas();
    }

    startNewGame() {
        this.sound.init();
        document.getElementById('screen-menu').classList.add('hidden');
        document.getElementById('screen-creator').classList.remove('hidden');
    }

    initCreatorCanvas() {
        this.cCanvas = document.getElementById('creatorCanvas');
        this.cCtx = this.cCanvas.getContext('2d');
        this.updateCreator();
    }

    updateCreator() {
        this.player.gender = document.getElementById('c-gender').value;
        this.player.hair = parseInt(document.getElementById('c-hair').value);
        this.player.hairColor = document.getElementById('c-haircolor').value;
        this.player.skinColor = document.getElementById('c-skin').value;
        this.player.shirtColor = document.getElementById('c-shirt').value;
        this.player.pantsColor = document.getElementById('c-pants').value;

        // Draw preview on creator canvas
        this.cCtx.clearRect(0,0,128,128);
        this.drawCharacterSprite(this.cCtx, 48, 32, 2, this.player, 'down', 0);
    }

    randomizeCreator() {
        document.getElementById('c-hair').value = Math.floor(Math.random() * 3) + 1;
        document.getElementById('c-haircolor.value').value = '#' + Math.floor(Math.random()*16777215).toString(16);
        document.getElementById('c-skin').value = ['#ffd1b3', '#e0ac69', '#c68642'][Math.floor(Math.random()*3)];
        document.getElementById('c-shirt').value = '#' + Math.floor(Math.random()*16777215).toString(16);
        document.getElementById('c-pants').value = '#' + Math.floor(Math.random()*16777215).toString(16);
        this.updateCreator();
    }

    finishCharacterCreation() {
        document.getElementById('screen-creator').classList.add('hidden');
        document.getElementById('hud-top').classList.remove('hidden');
        document.getElementById('hud-buttons').classList.remove('hidden');
        document.getElementById('hotbar').classList.remove('hidden');
        if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
            document.getElementById('touch-controls').classList.remove('hidden');
        }

        // Give starting items
        this.player.inventory[0] = { id: 'hoe', count: 1 };
        this.player.inventory[1] = { id: 'watering_can', count: 1 };
        this.player.inventory[2] = { id: 'seed_carrot', count: 5 };
        this.player.inventory[3] = { id: 'sword', count: 1 };

        this.state = 'PLAYING';
        this.initWorld();
        this.buildHotbarUI();
        requestAnimationFrame(() => this.loop());
    }

    initWorld() {
        // Spawn starter trees and rocks in farm
        for(let i=0; i<5; i++) {
            this.worldObjects.push({ type: 'tree', x: 100 + i * 80, y: 100, hp: 3 });
            this.worldObjects.push({ type: 'rock', x: 100 + i * 70, y: 400, hp: 3 });
        }
    }

    // --- CONTROLS ---
    initControls() {
        window.addEventListener('keydown', e => {
            this.keys[e.key.toLowerCase()] = true;
            if (e.key.toLowerCase() === 'i') this.toggleWindow('inventory');
            if (e.key.toLowerCase() === 'c') this.toggleWindow('wardrobe');
            if (e.key.toLowerCase() === 'q') this.toggleWindow('quest');
            if (e.key.toLowerCase() === 'm') this.toggleWindow('map');
            if (e.key.toLowerCase() === 'e' || e.key === ' ') this.handleAction();
            if (e.key.toLowerCase() === 'f') this.handleTool();
        });
        window.addEventListener('keyup', e => { this.keys[e.key.toLowerCase()] = false; });

        // Touch Joystick
        const joystick = document.getElementById('virtual-joystick');
        const knob = document.getElementById('joystick-knob');
        let touching = false, startX = 0, startY = 0;

        joystick.addEventListener('touchstart', e => {
            touching = true;
            const touch = e.touches[0];
            const rect = joystick.getBoundingClientRect();
            startX = rect.left + rect.width / 2;
            startY = rect.top + rect.height / 2;
        });

        window.addEventListener('touchmove', e => {
            if (!touching) return;
            const touch = e.touches[0];
            let dx = touch.clientX - startX;
            let dy = touch.clientY - startY;
            let dist = Math.hypot(dx, dy);
            let maxDist = 40;
            if (dist > maxDist) {
                dx = (dx / dist) * maxDist;
                dy = (dy / dist) * maxDist;
            }
            knob.style.transform = `translate(${dx}px, ${dy}px)`;
            
            this.touchDx = dx / maxDist;
            this.touchDy = dy / maxDist;
        });

        window.addEventListener('touchend', () => {
            touching = false;
            knob.style.transform = `translate(0px, 0px)`;
            this.touchDx = 0;
            this.touchDy = 0;
        });
    }

    // --- GAME LOOP & UPDATE ---
    loop() {
        if (this.state !== 'PLAYING') return;
        this.update();
        this.render();
        requestAnimationFrame(() => this.loop());
    }

    update() {
        // Time progression (1 real second = 1 game minute roughly)
        this.time.minute += 1;
        if (this.time.minute >= 60) {
            this.time.minute = 0;
            this.time.hour += 1;
            if (this.time.hour >= 24) {
                this.time.hour = 6;
                this.time.day += 1;
                this.updateCropsDaily();
                if (this.time.day > 28) {
                    this.time.day = 1;
                    const seasons = ['Spring', 'Summer', 'Autumn', 'Winter'];
                    let idx = seasons.indexOf(this.time.season);
                    this.time.season = seasons[(idx + 1) % 4];
                }
            }
        }

        // Player Movement
        let dx = 0, dy = 0;
        if (this.keys['w'] || this.keys['arrowup']) { dy = -1; this.player.facing = 'up'; }
        if (this.keys['s'] || this.keys['arrowdown']) { dy = 1; this.player.facing = 'down'; }
        if (this.keys['a'] || this.keys['arrowleft']) { dx = -1; this.player.facing = 'left'; }
        if (this.keys['d'] || this.keys['arrowright']) { dx = 1; this.player.facing = 'right'; }

        if (this.touchDx !== undefined && (this.touchDx !== 0 || this.touchDy !== 0)) {
            dx = this.touchDx;
            dy = this.touchDy;
            if (Math.abs(dx) > Math.abs(dy)) {
                this.player.facing = dx > 0 ? 'right' : 'left';
            } else {
                this.player.facing = dy > 0 ? 'down' : 'up';
            }
        }

        if (dx !== 0 || dy !== 0) {
            let len = Math.hypot(dx, dy);
            this.player.x += (dx / len) * this.player.speed;
            this.player.y += (dy / len) * this.player.speed;
            this.player.moving = true;
            this.player.animTimer += 0.15;
            if (Math.random() < 0.1) this.sound.step();
        } else {
            this.player.moving = false;
        }

        // Boundary Check / Zone Change
        if (this.player.x < 50) { this.currentZone = 'forest'; }
        else if (this.player.x > this.canvas.width - 50) { this.currentZone = 'village'; }
        else { this.currentZone = 'farm'; }

        // Update UI HUD
        document.getElementById('hud-time').innerText = `${String(this.time.hour).padStart(2,'0')}:${String(this.time.minute).padStart(2,'0')}`;
        document.getElementById('hud-date').innerText = `${this.time.season} ${this.time.day} (Y${this.time.year})`;
        document.getElementById('hud-gold').innerText = `💰 ${this.gold}G`;
        document.getElementById('hp-fill').style.width = `${(this.hp / this.maxHp) * 100}%`;
        document.getElementById('energy-fill').style.width = `${(this.energy / this.maxEnergy) * 100}%`;
    }

    // --- RENDERING ---
    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Background / Ground Color based on zone & weather
        if (this.currentZone === 'farm') this.ctx.fillStyle = '#27ae60';
        else if (this.currentZone === 'village') this.ctx.fillStyle = '#95a5a6';
        else if (this.currentZone === 'forest') this.ctx.fillStyle = '#1e8449';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw Farm Tiles
        for (let key in this.farmTiles) {
            let [fx, fy] = key.split(',').map(Number);
            let tile = this.farmTiles[key];
            this.ctx.fillStyle = tile.watered ? '#5d4037' : '#795548';
            this.ctx.fillRect(fx, fy, 32, 32);
            this.ctx.strokeStyle = '#3e2723';
            this.ctx.strokeRect(fx, fy, 32, 32);

            if (tile.crop) {
                let cropData = CROPS[tile.crop];
                let stageChar = cropData.stages[tile.stage || 0];
                this.ctx.font = '20px monospace';
                this.ctx.fillText(stageChar, fx + 6, fy + 24);
            }
        }

        // Draw World Objects (Trees, Rocks)
        this.worldObjects.forEach(obj => {
            this.ctx.font = '32px monospace';
            let icon = obj.type === 'tree' ? '🌲' : '🪨';
            this.ctx.fillText(icon, obj.x, obj.y);
        });

        // Draw Player
        let pAnim = this.player.moving ? Math.floor(this.player.animTimer) % 2 : 0;
        this.drawCharacterSprite(this.ctx, this.player.x, this.player.y, 1.5, this.player, this.player.facing, pAnim);

        // Sky overlay for night / evening
        if (this.time.hour >= 19 || this.time.hour < 6) {
            this.ctx.fillStyle = 'rgba(10, 10, 40, 0.6)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        } else if (this.time.hour >= 17) {
            this.ctx.fillStyle = 'rgba(230, 126, 34, 0.3)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    drawCharacterSprite(ctx, x, y, scale, p, facing, anim) {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(scale, scale);

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.arc(10, 28, 8, 0, Math.PI * 2);
        ctx.fill();

        // Body / Skin
        ctx.fillStyle = p.skinColor;
        ctx.fillRect(4, 8, 12, 12);

        // Shirt
        ctx.fillStyle = p.shirtColor;
        ctx.fillRect(3, 20, 14, 8);

        // Pants
        ctx.fillStyle = p.pantsColor;
        ctx.fillRect(5, 28, 4, 6);
        ctx.fillRect(11, 28, 4, 6);

        // Hair
        ctx.fillStyle = p.hairColor;
        ctx.fillRect(4, 4, 12, 6);

        ctx.restore();
    }

    // --- ACTIONS & FARMING ---
    handleAction() {
        if (this.state !== 'PLAYING') return;
        // Check front tile for farming interaction
        let tx = Math.floor((this.player.x + 16) / 32) * 32;
        let ty = Math.floor((this.player.y + 16) / 32) * 32;
        let key = `${tx},${ty}`;

        let activeItem = this.player.inventory[this.player.activeSlot];

        if (activeItem && activeItem.id === 'hoe') {
            if (!this.farmTiles[key]) {
                this.farmTiles[key] = { tilled: true, watered: false, crop: null, stage: 0 };
                this.sound.chop();
                this.consumeEnergy(2);
            }
        } else if (activeItem && activeItem.id === 'watering_can') {
            if (this.farmTiles[key] && this.farmTiles[key].tilled) {
                this.farmTiles[key].watered = true;
                this.sound.water();
                this.consumeEnergy(2);
            }
        } else if (activeItem && activeItem.type === 'seed') {
            if (this.farmTiles[key] && this.farmTiles[key].tilled && !this.farmTiles[key].crop) {
                let cropName = activeItem.id.replace('seed_', '');
                this.farmTiles[key].crop = cropName;
                this.farmTiles[key].stage = 0;
                activeItem.count--;
                if (activeItem.count <= 0) this.player.inventory[this.player.activeSlot] = null;
                this.sound.step();
                this.buildHotbarUI();
            }
        } else {
            // Harvest if mature
            if (this.farmTiles[key] && this.farmTiles[key].crop) {
                let tile = this.farmTiles[key];
                let cropData = CROPS[tile.crop];
                if (tile.stage >= cropData.stages.length - 1) {
                    this.addItemToInventory(tile.crop, 1);
                    this.sound.coin();
                    tile.crop = null;
                    tile.tilled = false;
                    this.checkQuest('harvest_' + tile.crop);
                }
            }
        }
    }

    handleTool() {
        // Switch active slot or use tool
        this.player.activeSlot = (this.player.activeSlot + 1) % 5;
        this.buildHotbarUI();
    }

    consumeEnergy(amt) {
        this.energy -= amt;
        if (this.energy < 0) {
            this.energy = 0;
            this.hp -= 5;
        }
    }

    updateCropsDaily() {
        for (let key in this.farmTiles) {
            let tile = this.farmTiles[key];
            if (tile.crop && tile.watered) {
                let cropData = CROPS[tile.crop];
                if (tile.stage < cropData.stages.length - 1) {
                    tile.stage++;
                }
            }
            tile.watered = false; // Reset water status daily (unless it rains)
        }
    }

    // --- INVENTORY & UI ---
    buildHotbarUI() {
        const hotbar = document.getElementById('hotbar');
        hotbar.innerHTML = '';
        for (let i = 0; i < 5; i++) {
            let item = this.player.inventory[i];
            let slot = document.createElement('div');
            slot.className = `hotbar-slot ${i === this.player.activeSlot ? 'active' : ''}`;
            slot.onclick = () => { this.player.activeSlot = i; this.buildHotbarUI(); };
            if (item && ITEMS[item.id]) {
                slot.innerHTML = `${ITEMS[item.id].icon}<span class="slot-count">${item.count > 1 ? item.count : ''}</span>`;
            }
            hotbar.appendChild(slot);
        }
    }

    addItemToInventory(itemId, count) {
        for (let i = 0; i < this.player.inventory.length; i++) {
            if (this.player.inventory[i] && this.player.inventory[i].id === itemId) {
                this.player.inventory[i].count += count;
                this.buildHotbarUI();
                return true;
            }
        }
        for (let i = 0; i < this.player.inventory.length; i++) {
            if (!this.player.inventory[i]) {
                this.player.inventory[i] = { id: itemId, count: count };
                this.buildHotbarUI();
                return true;
            }
        }
        return false;
    }

    toggleWindow(type) {
        const modal = document.getElementById('window-modal');
        const body = document.getElementById('modal-body');
        if (this.currentWindow === type) {
            this.closeWindow();
            return;
        }
        this.currentWindow = type;
        modal.classList.remove('hidden');
        body.innerHTML = '';

        if (type === 'inventory') {
            body.innerHTML = '<h3>Inventory</h3><div class="inv-grid" id="modal-inv"></div>';
            const invGrid = document.getElementById('modal-inv');
            this.player.inventory.forEach((item, idx) => {
                let slot = document.createElement('div');
                slot.className = 'inv-slot';
                if (item && ITEMS[item.id]) {
                    slot.innerHTML = `${ITEMS[item.id].icon}<span class="slot-count">${item.count > 1 ? item.count : ''}</span>`;
                }
                invGrid.appendChild(slot);
            });
        } else if (type === 'wardrobe') {
            body.innerHTML = `<h3>Wardrobe / Customization</h3>
                <p>Change your outfit and look anytime!</p>
                <button class="main-btn" onclick="game.player.shirtColor='#e74c3c'; game.buildHotbarUI()">Change Shirt Red</button>
                <button class="main-btn" onclick="game.player.shirtColor='#3498db'; game.buildHotbarUI()">Change Shirt Blue</button>`;
        } else if (type === 'quest') {
            let html = '<h3>Quests</h3>';
            this.quests.forEach(q => {
                html += `<div style="background:#1a252f; padding:10px; margin-top:8px; border-radius:5px;">
                    <strong>${q.title}</strong><br>${q.desc}<br>Status: ${q.completed ? '✅ Completed' : '🔄 In Progress'}
                </div>`;
            });
            body.innerHTML = html;
        } else if (type === 'map') {
            body.innerHTML = `<h3>World Map</h3>
                <p>Current Zone: <strong>${this.currentZone.toUpperCase()}</strong></p>
                <div style="background:#1a252f; padding:20px; text-align:center; border-radius:8px; margin-top:15px;">
                    🌲 Forest &lt;--- 🏡 Farm --- 🏘️ Village --- ⛏️ Mine
                </div>`;
        }
    }

    closeWindow() {
        document.getElementById('window-modal').classList.add('hidden');
        this.currentWindow = null;
    }

    checkQuest(goalKey) {
        this.quests.forEach(q => {
            if (q.goal === goalKey && !q.completed) {
                q.current++;
                if (q.current >= q.max) {
                    q.completed = true;
                    this.gold += q.reward;
                    this.sound.coin();
                    alert(`Quest Completed: ${q.title}! Reward: ${q.reward}G`);
                }
            }
        });
    }

    // --- SAVE / LOAD SYSTEM ---
    saveGame() {
        const saveData = {
            time: this.time,
            gold: this.gold,
            hp: this.hp,
            energy: this.energy,
            player: this.player,
            farmTiles: this.farmTiles,
            quests: this.quests
        };
        localStorage.setItem('pixel_harvest_save', JSON.stringify(saveData));
        alert('Game Saved Successfully!');
    }

    loadGame() {
        const data = localStorage.getItem('pixel_harvest_save');
        if (!data) return;
        const saveData = JSON.parse(data);
        this.time = saveData.time;
        this.gold = saveData.gold;
        this.hp = saveData.hp;
        this.energy = saveData.energy;
        this.player = saveData.player;
        this.farmTiles = saveData.farmTiles;
        this.quests = saveData.quests;

        document.getElementById('screen-menu').classList.add('hidden');
        document.getElementById('hud-top').classList.remove('hidden');
        document.getElementById('hud-buttons').classList.remove('hidden');
        document.getElementById('hotbar').classList.remove('hidden');
        if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
            document.getElementById('touch-controls').classList.remove('hidden');
        }
        this.state = 'PLAYING';
        this.buildHotbarUI();
        requestAnimationFrame(() => this.loop());
    }
}

// Initialize Game Instance
const game = new Game();

// Check load button visibility on startup
window.addEventListener('load', () => {
    if (localStorage.getItem('pixel_harvest_save')) {
        document.getElementById('btn-load').style.display = 'inline-block';
    }
});
