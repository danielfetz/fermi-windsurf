/**
 * Database module for setting up and interacting with Supabase database
 */
const Database = (function() {
    // Initialize database
    const init = async () => {
        try {
            // Check if tables exist
            const { data: tablesData, error: tablesError } = await supabase
                .rpc('get_tables');
                
            if (tablesError) throw tablesError;
            
            const tables = tablesData.map(t => t.table_name);
            
            // Create tables if they don't exist
            if (!tables.includes('profiles')) {
                await createProfilesTable();
            }
            
            if (!tables.includes('games')) {
                await createGamesTable();
            }
            
            if (!tables.includes('questions')) {
                await createQuestionsTable();
                await seedQuestions();
            }
            
            console.log('Database initialized');
        } catch (error) {
            console.error('Error initializing database:', error);
            alert('Failed to initialize database. Please check console for details.');
        }
    };
    
    // Create profiles table
    const createProfilesTable = async () => {
        const { error } = await supabase
            .from('profiles')
            .create([
                {
                    id: 'schema',
                    username: 'schema',
                    created_at: new Date().toISOString()
                }
            ]);
            
        if (error && !error.message.includes('already exists')) {
            throw error;
        }
        
        // Set up RLS policy
        await supabase.rpc('create_profile_policies');
        
        console.log('Profiles table created');
    };
    
    // Create games table
    const createGamesTable = async () => {
        const { error } = await supabase
            .from('games')
            .create([
                {
                    id: 'schema',
                    name: 'schema',
                    creator_id: 'schema',
                    status: 'schema',
                    created_at: new Date().toISOString()
                }
            ]);
            
        if (error && !error.message.includes('already exists')) {
            throw error;
        }
        
        // Set up RLS policy
        await supabase.rpc('create_game_policies');
        
        console.log('Games table created');
    };
    
    // Create questions table
    const createQuestionsTable = async () => {
        const { error } = await supabase
            .from('questions')
            .create([
                {
                    id: 1,
                    question: 'schema',
                    answer: 0,
                    hint1: 'schema',
                    hint2: 'schema',
                    category: 'schema',
                    difficulty: 'easy'
                }
            ]);
            
        if (error && !error.message.includes('already exists')) {
            throw error;
        }
        
        console.log('Questions table created');
    };
    
    // Seed questions
    const seedQuestions = async () => {
        // Some sample Fermi questions
        const questions = [
            {
                question: "How many piano tuners are there in Chicago?",
                answer: 125,
                hint1: "The population of Chicago is about 2.7 million",
                hint2: "The average piano tuner services about 200 pianos per year",
                category: "population",
                difficulty: "medium"
            },
            {
                question: "How many sheets of paper are used in the U.S. annually?",
                answer: 10000000000,
                hint1: "There are about 330 million people in the U.S.",
                hint2: "The average office worker uses about 10,000 sheets per year",
                category: "consumption",
                difficulty: "medium"
            },
            {
                question: "How many grains of sand would it take to cover Manhattan?",
                answer: 1000000000000000,
                hint1: "Manhattan is about 59 square kilometers",
                hint2: "A grain of sand is about 0.5mm in diameter",
                category: "physical",
                difficulty: "hard"
            },
            {
                question: "How many heartbeats does the average person have in their lifetime?",
                answer: 2500000000,
                hint1: "The average heart rate is about 70 beats per minute",
                hint2: "The average human lifespan is about 75 years",
                category: "biology",
                difficulty: "easy"
            },
            {
                question: "How many pizzas are consumed in the U.S. each day?",
                answer: 3000000,
                hint1: "Americans eat about 350 slices of pizza per second",
                hint2: "The average pizza has 8 slices",
                category: "food",
                difficulty: "medium"
            },
            {
                question: "How many commercial flights take off worldwide each day?",
                answer: 100000,
                hint1: "There are about 20,000 commercial aircraft in service",
                hint2: "The average commercial aircraft performs 3-5 flights per day",
                category: "transportation",
                difficulty: "medium"
            },
            {
                question: "How many breaths will you take in your lifetime?",
                answer: 500000000,
                hint1: "The average person breathes about 12-20 times per minute",
                hint2: "The average human lifespan is about 75 years",
                category: "biology",
                difficulty: "easy"
            },
            {
                question: "How many words are in all Harry Potter books combined?",
                answer: 1084170,
                hint1: "There are 7 Harry Potter books",
                hint2: "The average novel has about 90,000 words",
                category: "literature",
                difficulty: "medium"
            },
            {
                question: "How many stars are in our galaxy?",
                answer: 100000000000,
                hint1: "Our galaxy is the Milky Way",
                hint2: "The diameter of the Milky Way is about 100,000 light years",
                category: "astronomy",
                difficulty: "hard"
            },
            {
                question: "How many seconds have passed since the year 1900?",
                answer: 3800000000,
                hint1: "There are 86,400 seconds in a day",
                hint2: "There are about 365.25 days in a year",
                category: "time",
                difficulty: "easy"
            }
        ];
        
        // Insert questions in batches to avoid payload size limits
        const batchSize = 3;
        for (let i = 0; i < questions.length; i += batchSize) {
            const batch = questions.slice(i, i + batchSize);
            
            const { error } = await supabase
                .from('questions')
                .insert(batch);
                
            if (error) throw error;
        }
        
        console.log('Questions seeded');
    };
    
    // Return public methods
    return {
        init
    };
})();
