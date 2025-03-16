from flask import Flask, render_template, jsonify, request, send_from_directory
from flask_cors import CORS  # Import CORS
import random
import os
import json
import time
import uuid
app = Flask(__name__)
app.config['STATIC_FOLDER'] = 'static'
# Enable CORS for all routes and origins
CORS(app)
# Keep track of registered players
registered_players = {}

# Game state
game_state = {
    'score': 0,
    'block_speed': 0.3,  # Reduced speed for slower movement
    'game_over': False,
    'blocks': [],
    'buckets': [],
    'special_blocks': [],
    'animations': [],
    'last_spawn_time': time.time(),
    'blocks_spawned_in_period': 0,
    'spawn_period': 3,  # seconds
    'max_blocks_per_period': 5,
    'last_special_spawn_time': time.time(),
    'special_spawn_period': 15,  # seconds
    'game_id': random.randint(1000, 9999)  # Used to identify game session
}

# Block types and corresponding image paths
BLOCK_IMAGES = {
    "monky1": "monky2.png",
    "monky2": "monky1.png",
    "peacock1": "peacock1.png",
    "squirrel3": "squirrel3.png",
    "bandu": "bandu.png",
    "isha": "isha.png"
}

BUCKET_IMAGES = {
    "monky1": "monkey.png",
    "monky2": "monkey2.png",
    "peacock1": "pea.png",
    "squirrel3": "sq.png"
}

SPECIAL_TYPES = ["bandu", "isha"]
REGULAR_BLOCK_TYPES = ["monky1", "monky2", "peacock1", "squirrel3"]

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/static/<path:path>')
def send_static(path):
    return send_from_directory('static', path)

@app.route('/api/register-player', methods=['POST'])
def register_player():
    data = request.json
    username = data.get('username', 'Anonymous')
    unique_id = data.get('uniqueId', str(uuid.uuid4()))
    
    # Register the player
    registered_players[unique_id] = {
        'username': username,
        'registration_time': time.strftime('%Y-%m-%d %H:%M:%S'),
        'games_played': 0,
        'high_score': 0
    }
    
    # Print player information to console
    print(f"\n=== NEW PLAYER REGISTERED ===")
    print(f"Username: {username}")
    print(f"Unique ID: {unique_id}")
    print(f"Registration Time: {registered_players[unique_id]['registration_time']}")
    print("==============================\n")
    
    return jsonify({
        'success': True,
        'username': username,
        'uniqueId': unique_id,
        'message': 'Player registered successfully'
    })

@app.route('/api/game-state')
def get_game_state():
    return jsonify(game_state)

@app.route('/api/reset-game', methods=['POST'])
def reset_game_api():
    data = request.json
    username = data.get('username', 'Anonymous')
    unique_id = data.get('uniqueId', '')
    
    # Update player stats
    if unique_id in registered_players:
        registered_players[unique_id]['games_played'] += 1
        print(f"Starting new game for {username} (ID: {unique_id})")
    
    reset_game()
    return jsonify(game_state)

@app.route('/api/spawn-block', methods=['POST'])
def spawn_block_api():
    data = request.json
    special = data.get('special', False)
    block = spawn_block(special)
    return jsonify(block)

@app.route('/api/init-buckets', methods=['POST'])
def init_buckets_api():
    data = request.json
    play_area = data.get('playArea', {})
    buckets = init_buckets(play_area)
    game_state['buckets'] = buckets
    return jsonify(buckets)

@app.route('/api/drag-block', methods=['POST'])
def drag_block_api():
    data = request.json
    block_id = data.get('blockId')
    position = data.get('position', {})
    
    for block in game_state['blocks']:
        if block['id'] == block_id:
            block['x'] = position.get('x', block['x'])
            block['y'] = position.get('y', block['y'])
            block['dragging'] = True
            break
    
    return jsonify({'success': True})

@app.route('/api/drop-block', methods=['POST'])
def drop_block_api():
    data = request.json
    block_id = data.get('blockId')
    position = data.get('position', {})
    bucket_id = data.get('bucketId')
    username = data.get('username', 'Anonymous')
    
    result = {
        'success': True,
        'block_removed': False,
        'score_change': 0,
        'bucket_hit': None,
        'game_over': False
    }
    
    block_to_remove = None
    
    # Find the block being dropped
    for block in game_state['blocks']:
        if block['id'] == block_id:
            block['x'] = position.get('x', block['x'])
            block['y'] = position.get('y', block['y'])
            block['dragging'] = False
            
            # If client detected bucket collision, use that directly
            if bucket_id:
                # Find the matching bucket
                for bucket in game_state['buckets']:
                    if bucket['id'] == bucket_id:
                        result['bucket_hit'] = bucket_id
                        
                        # Check if the block type matches the bucket type
                        if block['type'] == bucket['type']:
                            game_state['score'] += 10
                            result['score_change'] = 10
                            bucket['animating'] = True
                            bucket['animation_start'] = time.time()
                            print(f"Player {username} matched {block['type']} correctly!")
                        else:
                            game_state['score'] -= 5
                            result['score_change'] = -5
                            bucket['shaking'] = True
                            bucket['shake_start'] = time.time()
                            print(f"Player {username} mismatched {block['type']} with {bucket['type']}")
                        
                        if game_state['score'] <= 0:
                            game_state['score'] = 0
                            game_state['game_over'] = True
                            result['game_over'] = True
                        
                        block_to_remove = block
                        break
            # Fallback to server-side collision detection
            else:
                for bucket in game_state['buckets']:
                    if is_collision(block, bucket):
                        result['bucket_hit'] = bucket['id']
                        
                        if block['type'] == bucket['type']:
                            game_state['score'] += 10
                            result['score_change'] = 10
                            bucket['animating'] = True
                            bucket['animation_start'] = time.time()
                            print(f"Player {username} matched {block['type']} correctly!")
                        else:
                            game_state['score'] -= 5
                            result['score_change'] = -5
                            bucket['shaking'] = True
                            bucket['shake_start'] = time.time()
                            print(f"Player {username} mismatched {block['type']} with {bucket['type']}")
                        
                        if game_state['score'] <= 0:
                            game_state['score'] = 0
                            game_state['game_over'] = True
                            result['game_over'] = True
                        
                        block_to_remove = block
                        break
            break
    
    # Remove the block if it hit a bucket
    if block_to_remove:
        game_state['blocks'].remove(block_to_remove)
        result['block_removed'] = True
    
    result['current_score'] = game_state['score']
    return jsonify(result)

@app.route('/api/attack-special', methods=['POST'])
def attack_special_api():
    data = request.json
    block_id = data.get('blockId')
    username = data.get('username', 'Anonymous')
    
    result = {
        'success': False,
        'block_removed': False,
        'score_change': 0,
        'explosion': None
    }
    
    for block in game_state['blocks']:
        if block['id'] == block_id and block.get('is_special', False):
            block['health'] -= 1
            result['success'] = True
            
            # Create small explosion animation
            explosion = {
                'id': f"explosion_{random.randint(1000, 9999)}",
                'x': block['x'] + block['width'] / 2,
                'y': block['y'] + block['height'] / 2,
                'is_final': False,
                'start_time': time.time()
            }
            game_state['animations'].append(explosion)
            result['explosion'] = explosion
            
            if block['health'] <= 0:
                game_state['score'] += 40
                result['score_change'] = 40
                game_state['blocks'].remove(block)
                result['block_removed'] = True
                print(f"Player {username} destroyed special block {block['type']}!")
                
                # Create final explosion animation
                final_explosion = {
                    'id': f"explosion_{random.randint(1000, 9999)}",
                    'x': block['x'] + block['width'] / 2,
                    'y': block['y'] + block['height'] / 2,
                    'is_final': True,
                    'start_time': time.time()
                }
                game_state['animations'].append(final_explosion)
            
            break
    
    result['current_score'] = game_state['score']
    return jsonify(result)

@app.route('/api/game-over', methods=['POST'])
def game_over_api():
    data = request.json
    username = data.get('username', 'Anonymous')
    unique_id = data.get('uniqueId', '')
    final_score = data.get('score', 0)
    
    # Update player's high score if applicable
    if unique_id in registered_players:
        if final_score > registered_players[unique_id].get('high_score', 0):
            registered_players[unique_id]['high_score'] = final_score
            print(f"New high score for {username}: {final_score}")
        
        print(f"\n=== GAME OVER ===")
        print(f"Player: {username} (ID: {unique_id})")
        print(f"Final Score: {final_score}")
        print(f"High Score: {registered_players[unique_id]['high_score']}")
        print(f"Games Played: {registered_players[unique_id]['games_played']}")
        print("================\n")
    
    return jsonify({
        'success': True,
        'message': 'Game over recorded'
    })

@app.route('/api/update-game', methods=['POST'])
def update_game_api():
    if game_state['game_over']:
        return jsonify({
            'game_over': True,
            'score': game_state['score']
        })
    
    current_time = time.time()
    
    # Update blocks position
    for block in game_state['blocks']:
        if not block.get('dragging', False):
            block['y'] += block['speed']
            
            if block.get('is_special', False):
                block['direction_change_timer'] = block.get('direction_change_timer', 0) + 1
                
                if block['direction_change_timer'] >= block.get('direction_change_delay', 60):
                    # Slower horizontal speed for special blocks
                    block['horizontal_speed'] = random.choice([-0.2, -0.15, 0.15, 0.2])
                    block['direction_change_timer'] = 0
                    block['direction_change_delay'] = random.randint(30, 120)
                
                block['x'] += block['horizontal_speed']
                
                # Keep the special block within the play area
                if block['x'] < 0:
                    block['x'] = 0
                    block['horizontal_speed'] = abs(block['horizontal_speed'])
                elif block['x'] + block['width'] > 100:  # Assuming 100% width
                    block['x'] = 100 - block['width']
                    block['horizontal_speed'] = -abs(block['horizontal_speed'])
    
    # Remove blocks that fall out of the play area
    game_state['blocks'] = [b for b in game_state['blocks'] if b['y'] <= 100]  # Assuming 100% height
    
    # Check for new block spawning
    if current_time - game_state['last_spawn_time'] > game_state['spawn_period']:
        game_state['blocks_spawned_in_period'] = 0
        game_state['last_spawn_time'] = current_time
    
    # Reduce spawn rate (from 0.01 to 0.005 for less frequent spawning)
    if game_state['blocks_spawned_in_period'] < game_state['max_blocks_per_period'] and random.random() < 0.005:
        spawn_block(False)
        game_state['blocks_spawned_in_period'] += 1
    
    # Check for special block spawning (increased period from 10 to 15 seconds)
    if current_time - game_state['last_special_spawn_time'] > 15:
        spawn_block(True)
        game_state['last_special_spawn_time'] = current_time
    
    # Remove animations that have completed
    current_time = time.time()
    game_state['animations'] = [a for a in game_state['animations'] 
                              if current_time - a['start_time'] < (1.0 if a['is_final'] else 0.5)]
    
    # Reset bucket animations
    for bucket in game_state['buckets']:
        if bucket.get('animating', False) and current_time - bucket.get('animation_start', 0) > 0.5:
            bucket['animating'] = False
        
        if bucket.get('shaking', False) and current_time - bucket.get('shake_start', 0) > 0.5:
            bucket['shaking'] = False
    
    return jsonify({
        'game_over': game_state['game_over'],
        'score': game_state['score'],
        'blocks': game_state['blocks'],
        'animations': game_state['animations'],
        'buckets': game_state['buckets']
    })

def reset_game():
    global game_state
    game_state = {
        'score': 0,
        'block_speed': 0.3,  # Reduced speed
        'game_over': False,
        'blocks': [],
        'buckets': [],
        'animations': [],
        'last_spawn_time': time.time(),
        'blocks_spawned_in_period': 0,
        'spawn_period': 3,
        'max_blocks_per_period': 5,
        'last_special_spawn_time': time.time(),
        'special_spawn_period': 15,  # Increased from 10 to 15
        'game_id': random.randint(1000, 9999)
    }
    return game_state

def init_buckets(play_area):
    buckets = []
    
    # We'll create bucket objects for server-side collision detection
    # The visual representation is handled by the client-side HTML/CSS
    for i, bucket_type in enumerate(REGULAR_BLOCK_TYPES):
        # Calculate position based on the bucket container layout
        # These positions match the fixed HTML bucket container
        if i == 0:
            x_pos = 15  # Leftmost bucket
        elif i == 1:
            x_pos = 35  # Second from left
        elif i == 2:
            x_pos = 65  # Second from right
        else:
            x_pos = 85  # Rightmost bucket
        
        buckets.append({
            'id': f"bucket_{i}",
            'type': bucket_type,
            'image': BUCKET_IMAGES[bucket_type],
            'x': x_pos,
            'y': 80,  # Fixed at bottom
            'width': 20,  # Percentage width for detection
            'height': 15,  # Percentage height for detection
            'animating': False,
            'shaking': False,
            'animation_start': 0,
            'shake_start': 0
        })
    
    return buckets

def spawn_block(special=False):
    block_type = random.choice(SPECIAL_TYPES) if special else random.choice(REGULAR_BLOCK_TYPES)
    block_id = f"block_{random.randint(1000, 9999)}"
    
    block = {
        'id': block_id,
        'type': block_type,
        'image': BLOCK_IMAGES[block_type],
        'x': random.uniform(10, 90),  # Random position between 10-90% of play area width
        'y': 0,  # Start at the top
        'width': 10,  # Width as percentage of play area
        'height': 10,  # Height as percentage of play area
        'speed': game_state['block_speed'],
        'dragging': False
    }
    
    if special:
        block.update({
            'is_special': True,
            'can_drag': False,
            'health': 5,
            'max_health': 5,
            'horizontal_speed': random.choice([-0.2, -0.15, 0.15, 0.2]),  # Reduced speed
            'direction_change_timer': 0,
            'direction_change_delay': random.randint(30, 120)
        })
    else:
        block.update({
            'is_special': False,
            'can_drag': True,
            'health': 1
        })
    
    game_state['blocks'].append(block)
    return block

def is_collision(block, bucket):
    # Enhanced collision detection with better tolerances
    block_center_x = block['x'] + block['width'] / 2
    block_bottom = block['y'] + block['height']
    
    # Check if block center is within bucket width boundaries with wider tolerance
    bucket_left = bucket['x'] - bucket['width']/1.5
    bucket_right = bucket['x'] + bucket['width']/1.5
    horizontal_match = bucket_left <= block_center_x <= bucket_right
    
    # Check if block bottom is at bucket top with more vertical tolerance
    vertical_match = block_bottom >= bucket['y'] - 10 and block['y'] <= bucket['y'] + bucket['height']
    
    return horizontal_match and vertical_match

if __name__ == '__main__':
    # Make sure to have these directories in place
    os.makedirs('static/sounds', exist_ok=True)
    os.makedirs('static/images', exist_ok=True)
    os.makedirs('templates', exist_ok=True)
    
    print("Starting Animal Sorting Game Server")
    print("Login system enabled - waiting for players...")
    
    # Updated for Heroku deployment
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)