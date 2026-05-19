// REPLACE THIS WITH YOUR GOOGLE APPS SCRIPT WEB APP URL
const GOOGLE_APP_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby_Mock_URL/exec';

document.addEventListener('DOMContentLoaded', () => {

    // --- Navigation ---
    const navItems = document.querySelectorAll('.nav-item');
    const pageViews = document.querySelectorAll('.page-view');
    const headerTitle = document.getElementById('header-title');
    
    const titles = {
        'view-observation': 'Observation Report',
        'view-attempted': 'Attempted Nodes',
        'view-conveyance': 'Conveyance Claim'
    };

    navItems.forEach(nav => {
        nav.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = nav.getAttribute('data-target');
            
            navItems.forEach(n => n.classList.remove('active'));
            nav.classList.add('active');

            pageViews.forEach(page => {
                page.classList.remove('active');
                if(page.id === targetId) page.classList.add('active');
            });

            headerTitle.textContent = titles[targetId];
        });
    });

    // --- File Input UI ---
    document.querySelectorAll('input[type="file"]').forEach(input => {
        input.addEventListener('change', (e) => {
            const fileNameElem = e.target.closest('.file-uploader').querySelector('.file-name');
            fileNameElem.textContent = e.target.files.length > 0 ? e.target.files[0].name : "No file chosen";
        });
    });

    // --- Submit Button State ---
    const obsHost = document.getElementById('obs-host');
    const btnSubmitObs = document.getElementById('btn-submit-obs');
    if (obsHost && btnSubmitObs) {
        obsHost.addEventListener('change', (e) => {
            if (e.target.value !== "") {
                btnSubmitObs.removeAttribute('disabled');
            } else {
                btnSubmitObs.setAttribute('disabled', 'true');
            }
        });
    }

    // --- Conveyance Calculation ---
    const calcKm = document.getElementById('calc-km');
    const calcHotel = document.getElementById('calc-hotel');
    const areaRadios = document.getElementsByName('area_type');
    const calcOtherAmt = document.getElementById('calc-other-amt');

    function calculateConveyance() {
        if(!calcKm) return;
        
        const km = parseFloat(calcKm.value) || 0;
        const hotel = parseFloat(calcHotel.value) || 0;
        const other = parseFloat(calcOtherAmt.value) || 0;
        
        let isHill = false;
        areaRadios.forEach(r => { if(r.checked && r.value === 'Hill') isHill = true; });

        const rate = isHill ? 4 : 3;
        const kmCharges = km * rate;
        const da = km >= 140 ? 250 : 0;
        const extra = hotel + other;
        const total = kmCharges + da + extra;

        // Update UI
        document.getElementById('s-km').textContent = km;
        document.getElementById('s-rate').textContent = rate;
        document.getElementById('s-km-charge').textContent = kmCharges.toFixed(2);
        document.getElementById('s-da').textContent = da;
        document.getElementById('s-extra').textContent = extra.toFixed(2);
        document.getElementById('s-total').textContent = total.toFixed(2);
    }

    if(calcKm) calcKm.addEventListener('input', calculateConveyance);
    if(calcHotel) calcHotel.addEventListener('input', calculateConveyance);
    if(calcOtherAmt) calcOtherAmt.addEventListener('input', calculateConveyance);
    areaRadios.forEach(r => r.addEventListener('change', calculateConveyance));


    // --- Google Sheets Data Fetching (Mock/Real) ---
    window.refetchData = async function() {
        const dateVal = document.getElementById('obs-date').value;
        const engVal = document.getElementById('obs-engineer').value;
        const hostVal = document.getElementById('obs-host').value;

        if(!dateVal || !engVal || !hostVal) {
            showToast("Please select Date, Engineer, and Host first.", true);
            return;
        }

        showLoader();
        
        try {
            // Uncomment the fetch block below when GOOGLE_APP_SCRIPT_URL is real
            /*
            const url = new URL(GOOGLE_APP_SCRIPT_URL);
            url.searchParams.append('date', dateVal);
            url.searchParams.append('engineer', engVal);
            url.searchParams.append('host', hostVal);

            const response = await fetch(url.toString(), { method: 'GET' });
            const result = await response.json();
            
            if(result.status === 'success') {
                populateCRQ(result.data);
                showToast("Data fetched successfully.");
            } else {
                showToast("Failed to fetch data.");
            }
            */

            // Simulation for now
            setTimeout(() => {
                const mockData = {
                    crq: "CRQ-" + Math.floor(Math.random() * 900000 + 100000),
                    crqCreateDate: "2026-05-18",
                    workArea: "North Zone",
                    finalTier: "Tier 1",
                    teamLeader: "Alex Sharma",
                    engineerNumber: "ENG-" + Math.floor(Math.random() * 900 + 100),
                    productName: "Fiber Node X",
                    city: "New Delhi",
                    state: "Delhi",
                    tngCircle: "DL",
                    region: "NCR",
                    address: "123 Telecom Street, Sector 4, New Delhi"
                };
                populateCRQ(mockData);
                hideLoader();
                showToast("Data synced from Server");
            }, 800);

        } catch(err) {
            hideLoader();
            showToast("Error connecting to server.", true);
        }
    };

    function populateCRQ(data) {
        document.getElementById('crq-val').textContent = data.crq;
        document.getElementById('crq-date-val').textContent = data.crqCreateDate;
        document.getElementById('crq-area-val').textContent = data.workArea;
        document.getElementById('crq-tier-val').textContent = data.finalTier;
        document.getElementById('crq-tl-val').textContent = data.teamLeader;
        document.getElementById('crq-eng-val').textContent = data.engineerNumber;
        document.getElementById('crq-prod-val').textContent = data.productName;
        document.getElementById('crq-city-val').textContent = data.city;
        document.getElementById('crq-state-val').textContent = data.state;
        document.getElementById('crq-tng-val').textContent = data.tngCircle;
        document.getElementById('crq-region-val').textContent = data.region;
        document.getElementById('crq-addr-val').textContent = data.address;
    }

    // --- Google Sheets Form Submission ---
    document.querySelectorAll('form').forEach(form => {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Collect Data
            const formData = new FormData(form);
            const dataObj = Object.fromEntries(formData.entries());
            const formId = form.id.replace('form-', 'pmt-');

            const payload = {
                formType: formId,
                email: dataObj.email || '',
                engineerName: dataObj.engineer || '',
                hostName: dataObj.host || '',
                formData: dataObj
            };

            showLoader();

            try {
                // Uncomment to send real POST
                /*
                await fetch(GOOGLE_APP_SCRIPT_URL, {
                    method: 'POST',
                    mode: 'no-cors', // no-cors prevents reading the response but allows the post
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify(payload)
                });
                */
               
                setTimeout(() => {
                    hideLoader();
                    showToast("Report submitted successfully!");
                    form.reset();
                    if(formId === 'pmt-conveyance') calculateConveyance();
                    if(formId === 'pmt-observation') btnSubmitObs.setAttribute('disabled', 'true');
                }, 1000);

            } catch (err) {
                hideLoader();
                showToast("Failed to submit.", true);
            }
        });
    });

    // --- Utils ---
    const loader = document.getElementById('loader');
    function showLoader() { loader.classList.remove('hidden'); }
    function hideLoader() { loader.classList.add('hidden'); }

    function showToast(msg, isError = false) {
        const toast = document.getElementById('toast');
        toast.textContent = msg;
        toast.style.background = isError ? '#ef4444' : '#10b981';
        toast.classList.remove('hidden');
        
        // trigger reflow
        void toast.offsetWidth;
        
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.classList.add('hidden'), 300);
        }, 3000);
    }
});
