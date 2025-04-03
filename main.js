// load in data
let playerData;

window.addEventListener('scroll', () => {
    const documentHeight = document.documentElement.scrollHeight; // Full document height including dynamically generated content
    const viewportHeight = window.innerHeight; // The height of the viewport
    const scrollPosition = window.pageYOffset; // The current scroll position

    // Update the --scroll property based on the current scroll position and full document height
    //pushed
    document.body.style.setProperty('--scroll', scrollPosition / (documentHeight - viewportHeight));
}, false);

async function loadData() {
    playerData = await d3.csv("data/player stats.csv", (row) => {
        return {
            player: row.Player,
            season: row.Season,
            games: +row.Games,
            goals: +row.Goals,
            assists: +row.Assists,
            clean_sheets: +row['Clean Sheets'],
            thrown_up: +row['Thrown Up'],
            role: row.Role,
            position: row.Position
        };
    });

    scoreChart();
};

// execute loadData when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();      
});


// functions for ScoreChart
// Will be filterable to allow the user to select a season, toggle bewteen goals and assists
function scoreChart(){
    // season selector
    let selectedSeason = null; // Track selected season
    let selectedStat = "Goals"; // Default stat

    const seasonYearMap = { 1: 2022, 2: 2023, 3: 2024, 4: 2025 };

    const seasons = Array.from(new Set(playerData.map(d => d.season)))
        .sort((a, b) => a - b); // Ensure sorting by numerical values

    // Season Selector 
    const seasonSelector = d3.select("#seasonSelector")
        .append("div")
        .attr("id", "seasonButtons")
        .style("display", "flex");  

    seasonSelector.selectAll("button")
        .data(seasons)
        .enter()
        .append("button")
        .attr("class", "season-button")
        .attr("value", d => d)
        .text(d => seasonYearMap[d]) // Display mapped year
        .on("click", function(event, d) {
            if (selectedSeason === d) {
                // If the same button is clicked, reset selection
                selectedSeason = null;
                d3.selectAll(".season-button").classed("active", false);
            } else {
                // Otherwise, set the selected season
                selectedSeason = d;
                d3.selectAll(".season-button").classed("active", false);
                d3.select(this).classed("active", true);
            }
            updateChart(selectedSeason, selectedStat); // Update chart with selected season & stat
        });


    //  Stat Selector 
    const stats = ["Goals", "Assists"]; 

    const statSelector = d3.select("#statSelector")
        .append("div")
        .attr("id", "statButtons")
        .style("display", "flex");

    statSelector.selectAll("button")
        .data(stats)
        .enter()
        .append("button")
        .attr("class", "stat-button")
        .attr("value", d => d)
        .text(d => d)
        .on("click", function(event, d) {
            d3.selectAll(".stat-button").classed("active", false);
            d3.select(this).classed("active", true);
            updateChart(selectedSeason, d); // Update chart with selected stat & season
        });

    // Track current selections

    // Function to update chart
    function updateChart(season, stat) {
        selectedSeason = season;
        selectedStat = stat;
        createScoreChart(selectedSeason, selectedStat); 
    }

    updateChart(selectedSeason, selectedStat); // Initial chart creation
}


function createScoreChart(season, stat){
    // filter data based on selected season, show all time if no season is selected
    let filteredData;
    if (season === undefined || season === null) {
        filteredData = d3.rollup(
            playerData,
            v => ({
                goals: d3.sum(v, d => d.goals),
                assists: d3.sum(v, d => d.assists)
            }),
            d => d.player
        );
    
        filteredData = Array.from(filteredData, ([player, stats]) => ({
            player,
            ...stats
        }));
    } else {
        filteredData = playerData.filter(d => d.season === season);
    }
    
    // filter out players with no goals or assists
    if (stat== "Goals") {
        filteredData = filteredData.filter(d => d.goals > 0);
    }
    else if (stat == "Assists") {
        filteredData = filteredData.filter(d => d.assists > 0);
    }

    // filter by goals or assists
    const filteredData2 = filteredData.map(d => ({
        player: d.player,
        value: d[stat.toLowerCase()],
    }));
    
    // sort by descending order
    filteredData2.sort((a, b) => b.value - a.value);

    console.log(filteredData2);


    // create chart
    const margin = {top: 30, right: 20 , bottom: 40, left: 200},
          width = 960 - margin.left - margin.right,
          height = 500 - margin.top - margin.bottom;

    // Remove previous SVG to prevent duplicates
    d3.select("#scoreChart").selectAll("svg").remove();

    // Define scales
    const x = d3.scaleLinear()
        .domain([0, d3.max(filteredData2, d => d.value)])
        .range([0, width]); // Horizontal range for bar length

    const y = d3.scaleBand()
        .domain(filteredData2.map(d => d.player)) // Players on y-axis
        .range([0, height]) // Vertical positioning
        .padding(0.1); // Space between bars

    const svg = d3.select('#scoreChart')
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    function makeXGridlines(xScale) {
        return d3.axisBottom(xScale)
            .ticks(5)
            .tickSize(-height) // Extend across chart
            .tickFormat(""); // Hide tick labels
    }
    
    // Append vertical gridlines *before* bars so they are in the background
    svg.append("g")
    .attr("class", "grid")
    .attr("transform", `translate(0,${height})`)
    .call(makeXGridlines(x))
    .lower(); // Send to back


    // Add bars
    svg.selectAll(".bar")
        .data(filteredData2)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("y", d => y(d.player)) // Position based on player name
        .attr("x", 0) // Start at x=0
        .attr("width", d => x(d.value)) // Bar length based on value
        .attr("height", y.bandwidth()) // Bar height
        .attr("fill", "#54702b"); // Bar color

    // Add x-axis
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(5))
        .selectAll("text")
        .style("font-size", "12px");

    // Add y-axis
    svg.append("g")
        .call(d3.axisLeft(y))
        .attr("class", "y-axis")
        .selectAll("text")
        .style("font-size", "12px");

    // Add axis labels
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", height + 40)
        .attr("text-anchor", "middle")
        .text(stat)
        .style("font-size", "14px")
        .style("font-weight", "bold");

    svg.append("text")
        .attr("x", -height / 2)
        .attr("y", -margin.left + 40)
        .attr("transform", "rotate(-90)")
        .attr("text-anchor", "middle")
        .text("Players")
        .style("font-size", "14px")
        .style("font-weight", "bold");


    svg.selectAll('.tick text')
        .style('font-family', 'Sora')
        .style('font-size', '11px'); 

    //tooltip
    // Update mouseover events
    const tooltip = d3.select("body").append("div")
    .style("position", "absolute")
    .style("background", "#fff")
    .style("padding", "6px")
    .style("border", "1px solid #ccc")
    .style("border-radius", "4px")
    .style("font-size", "12px")
    .style("box-shadow", "2px 2px 5px rgba(0,0,0,0.2)")
    .style("opacity", 0);

    const mouseover = function(event, d) {
        tooltip.style("opacity", 1);
        d3.selectAll(".bar").style("opacity", 0.3); // Fade out other bars
        d3.select(this)
            .style("stroke", "black")
            .style("opacity", 1);
    };

    const mousemove = function(event, d) {
        tooltip.html(`
            <div style="color: #666">
                Player: <span style="color: #333; font-weight: 600">${d.player}</span>
            </div>
            <div style="color: #666">
                ${stat}: <span style="color: #333; font-weight: 600">${d.value}</span>
            </div>
        `)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 10) + "px");
    };

    const mouseleave = function(event, d) {
        tooltip.style("opacity", 0);
        d3.selectAll(".bar").style("opacity", 1); // Reset opacity for all bars
        d3.select(this).style("stroke", "none");
    };

    // Attach event listeners to bars
    svg.selectAll(".bar")
        .on("mouseover", mouseover)
        .on("mousemove", mousemove)
        .on("mouseleave", mouseleave);

}


